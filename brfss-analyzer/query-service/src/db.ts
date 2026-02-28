import { Database } from "duckdb-async";
import { existsSync } from "fs";

let db: Database | null = null;
let ready = false;

const DATA_ROOT = process.env.DATA_ROOT || "../data/processed/brfss/2023";
const PARQUET = process.env.BRFSS_PARQUET || `${DATA_ROOT}/brfss_2023.parquet`;
const QUERY_TIMEOUT_MS = 60_000;

export async function initDB(): Promise<void> {
  if (db) return;
  db = await Database.create(":memory:");
  await reloadViews();
}

export async function reloadViews(): Promise<{ ready: boolean; parquet: string }> {
  if (!db) throw new Error("DB not initialized");

  if (!existsSync(PARQUET)) {
    ready = false;
    throw new Error(`Missing parquet file: ${PARQUET}`);
  }

  await db.run(`CREATE OR REPLACE VIEW brfss_raw AS SELECT * FROM read_parquet('${PARQUET}')`);
  ready = true;
  return { ready, parquet: PARQUET };
}

export function isReady(): boolean {
  return ready;
}

export async function executeSQL(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!db) throw new Error("DB not initialized");
  if (!ready) throw new Error("Views not ready");

  const upperSQL = sql.toUpperCase().trim();
  let finalSQL = sql;
  if (!upperSQL.includes("LIMIT")) {
    finalSQL = sql.replace(/;?\s*$/, " LIMIT 10000");
  }

  const resultRows = await Promise.race([
    db.all(finalSQL),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Query timed out")), QUERY_TIMEOUT_MS)
    ),
  ]);

  if (!resultRows || resultRows.length === 0) return { columns: [], rows: [] };

  const columns = Object.keys(resultRows[0]);
  const rows = resultRows.map((row) =>
    columns.map((col) => {
      const v = (row as Record<string, unknown>)[col];
      return typeof v === "bigint" ? Number(v) : v;
    })
  );

  return { columns, rows };
}
