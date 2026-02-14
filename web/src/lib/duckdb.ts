import { TABLE_SCHEMAS } from "./schemas";

let dbInstance: unknown = null;
let connInstance: unknown = null;
let initPromise: Promise<void> | null = null;

const TABLE_FILES = TABLE_SCHEMAS.map((t) => t.name);

export async function initDuckDB(): Promise<void> {
  if (dbInstance) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const duckdb = await import("@duckdb/duckdb-wasm");

    // Load worker and WASM from same origin (public/)
    const worker = new Worker("/duckdb-browser-eh.worker.js");
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate("/duckdb-eh.wasm");

    const conn = await db.connect();

    // Register Parquet files via HTTP and create views
    for (const table of TABLE_FILES) {
      await db.registerFileURL(
        `${table}.parquet`,
        `/data/${table}.parquet`,
        duckdb.DuckDBDataProtocol.HTTP,
        false
      );
      await conn.query(`
        CREATE VIEW ${table} AS SELECT * FROM read_parquet('${table}.parquet')
      `);
    }

    dbInstance = db;
    connInstance = conn;
  })();

  return initPromise;
}

export async function queryDuckDB(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!connInstance) {
    throw new Error("DuckDB is not initialized. Call initDuckDB() first.");
  }

  const conn = connInstance as { query: (sql: string) => Promise<unknown> };

  // Inject LIMIT if not present
  const upperSQL = sql.toUpperCase().trim();
  let finalSQL = sql;
  if (!upperSQL.includes("LIMIT")) {
    finalSQL = sql.replace(/;?\s*$/, " LIMIT 10000");
  }

  const result = await conn.query(finalSQL);

  // DuckDB-WASM returns Apache Arrow tables
  const table = result as {
    schema: { fields: { name: string }[] };
    numRows: number;
    getChildAt: (i: number) => { toJSON: () => unknown[] } | null;
  };

  const columns = table.schema.fields.map((f) => f.name);
  const rows: unknown[][] = [];

  // Pre-extract column arrays for performance
  const colArrays = columns.map((_, j) => {
    const col = table.getChildAt(j);
    return col ? col.toJSON() : null;
  });

  for (let i = 0; i < table.numRows; i++) {
    const row: unknown[] = [];
    for (let j = 0; j < columns.length; j++) {
      let val = colArrays[j] ? colArrays[j]![i] : null;
      // DuckDB-WASM returns HUGEINT/large BIGINT as Int32Array buffers — coerce to Number
      if (val !== null && typeof val === "object" && ArrayBuffer.isView(val)) {
        const arr = val as Int32Array;
        // For values that fit in a safe integer, use the low 32-bit part
        // (high parts are 0 for values under ~2 billion)
        val = arr.length >= 2 && (arr[1] !== 0 || arr[2] !== 0 || arr[3] !== 0)
          ? Number(arr[0]) + Number(arr[1]) * 2 ** 32
          : Number(arr[0]);
      }
      // Convert remaining BigInt values to Number
      if (typeof val === "bigint") {
        val = Number(val);
      }
      row.push(val);
    }
    rows.push(row);
  }

  return { columns, rows };
}

export function isDuckDBReady(): boolean {
  return dbInstance !== null;
}
