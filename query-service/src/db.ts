import { Database } from "duckdb-async";

let db: Database | null = null;

const DATA_DIR = process.env.DATA_DIR || "/data";
const QUERY_TIMEOUT_MS = 30_000;

export async function initDB(): Promise<void> {
  if (db) return;

  db = await Database.create(":memory:");

  // Register Parquet files as views
  const views: [string, string][] = [
    ["claims", "medicaid-provider-spending.parquet"],
    ["hcpcs_lookup", "hcpcs_lookup.parquet"],
    ["npi_lookup", "npi_lookup.parquet"],
  ];

  for (const [viewName, fileName] of views) {
    const filePath = `${DATA_DIR}/${fileName}`;
    await db.run(
      `CREATE VIEW ${viewName} AS SELECT * FROM read_parquet('${filePath}')`
    );
  }

  console.log(
    "DuckDB initialized with views:",
    views.map(([v]) => v).join(", ")
  );
}

export async function executeSQL(
  sql: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!db) {
    throw new Error("DuckDB not initialized");
  }

  // Inject LIMIT 10000 if no LIMIT clause present
  const upperSQL = sql.toUpperCase().trim();
  let finalSQL = sql;
  if (!upperSQL.includes("LIMIT")) {
    finalSQL = sql.replace(/;?\s*$/, " LIMIT 10000");
  }

  const resultRows = await Promise.race([
    db.all(finalSQL),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Query timed out after 30 seconds")),
        QUERY_TIMEOUT_MS
      )
    ),
  ]);

  if (!resultRows || resultRows.length === 0) {
    return { columns: [], rows: [] };
  }

  // Extract column names from the first row
  const columns = Object.keys(resultRows[0]);

  // Convert objects to arrays, coercing BigInt to Number
  const rows: unknown[][] = resultRows.map((row) =>
    columns.map((col) => {
      const val = (row as Record<string, unknown>)[col];
      if (typeof val === "bigint") {
        return Number(val);
      }
      return val;
    })
  );

  return { columns, rows };
}
