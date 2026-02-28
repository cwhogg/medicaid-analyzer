import { Database } from "duckdb-async";
import { existsSync, createWriteStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import { dirname } from "path";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

let db: Database | null = null;
let ready = false;

// Accept DATA_DIR (standard) or DATA_ROOT (backward compat), default to /data (persistent volume)
const DATA_DIR = process.env.DATA_DIR || process.env.DATA_ROOT || "/data";
const PARQUET = process.env.BRFSS_PARQUET || `${DATA_DIR}/brfss_2023.parquet`;
const PARQUET_URL = process.env.BRFSS_PARQUET_URL || "";
const QUERY_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const MAX_RETRIES = 3;

async function ensureParquet(): Promise<void> {
  if (existsSync(PARQUET)) return;
  if (!PARQUET_URL) throw new Error(`Missing parquet file: ${PARQUET}`);

  console.log(`Parquet missing. Downloading from BRFSS_PARQUET_URL -> ${PARQUET}`);
  await mkdir(dirname(PARQUET), { recursive: true });

  const partialPath = `${PARQUET}.partial`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(PARQUET_URL, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!res.ok) {
        throw new Error(`Failed to download BRFSS parquet: ${res.status} ${res.statusText}`);
      }
      if (!res.body) {
        throw new Error("Response body is null");
      }

      // Stream download to avoid buffering entire file in memory
      const nodeStream = Readable.fromWeb(res.body as import("stream/web").ReadableStream);
      const fileStream = createWriteStream(partialPath);
      await pipeline(nodeStream, fileStream);

      // Verify file is non-empty
      const { statSync } = await import("fs");
      const stats = statSync(partialPath);
      if (stats.size === 0) {
        throw new Error("Downloaded BRFSS parquet is empty");
      }

      // Rename partial to final
      const { renameSync } = await import("fs");
      renameSync(partialPath, PARQUET);
      console.log(`Downloaded BRFSS parquet (${stats.size} bytes)`);
      return;
    } catch (err) {
      // Clean up partial file on failure
      try { await unlink(partialPath); } catch { /* ignore */ }

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.warn(`Download attempt ${attempt}/${MAX_RETRIES} failed: ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
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
