import { Database } from "duckdb-async";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";

let db: Database | null = null;
let ready = false;

const DATA_ROOT = process.env.DATA_ROOT || "/tmp";
const PARQUET = process.env.BRFSS_PARQUET || `${DATA_ROOT}/brfss_2023.parquet`;
const PARQUET_URL = process.env.BRFSS_PARQUET_URL || "";
const QUERY_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

async function ensureParquet(): Promise<void> {
  if (existsSync(PARQUET)) return;
  if (!PARQUET_URL) throw new Error(`Missing parquet file: ${PARQUET}`);

  console.log(`Parquet missing. Downloading from BRFSS_PARQUET_URL -> ${PARQUET}`);
  await mkdir(dirname(PARQUET), { recursive: true });

  const res = await fetch(PARQUET_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Failed to download BRFSS parquet: ${res.status} ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
  if (!ab || ab.byteLength === 0) {
    throw new Error("Downloaded BRFSS parquet is empty");
  }

  await writeFile(PARQUET, Buffer.from(ab));
  console.log(`Downloaded BRFSS parquet (${ab.byteLength} bytes)`);
}

export async function initDB(): Promise<void> {
  if (db) return;
  db = await Database.create(":memory:");
  try {
    await ensureParquet();
    await reloadViews();
  } catch (err) {
    ready = false;
    console.warn("BRFSS data not loaded yet:", err instanceof Error ? err.message : String(err));
  }
}

export async function reloadViews(): Promise<{ ready: boolean; parquet: string }> {
  if (!db) throw new Error("DB not initialized");

  if (!existsSync(PARQUET)) {
    await ensureParquet();
  }

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
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Query timed out")), QUERY_TIMEOUT_MS)),
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
