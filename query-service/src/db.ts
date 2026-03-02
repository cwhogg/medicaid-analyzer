import { Database } from "duckdb-async";
import { existsSync } from "fs";

let db: Database | null = null;
let viewsReady = false;

const DATA_DIR = process.env.DATA_DIR || "/data";
const QUERY_TIMEOUT_MS = 90_000;

const VIEWS: [string, string][] = [
  ["claims", "medicaid-provider-spending.parquet"],
  ["hcpcs_lookup", "hcpcs_lookup.parquet"],
  ["npi_lookup", "npi_lookup.parquet"],
  ["state_population", "state_population.parquet"],
  ["provider_stats", "provider_stats.parquet"],
  ["provider_hcpcs", "provider_hcpcs.parquet"],
  ["provider_monthly", "provider_monthly.parquet"],
  ["brfss", "brfss_harmonized.parquet"],
  ["medicare", "medicare_physician_2023.parquet"],
  ["nhanes", "nhanes_2021_2023.parquet"],
];

export async function initDB(): Promise<void> {
  if (db) return;

  db = await Database.create(":memory:");

  // Try to register views — skip missing files gracefully
  await tryCreateViews();
}

async function tryCreateViews(): Promise<void> {
  if (!db) return;

  const missing: string[] = [];
  const created: string[] = [];

  for (const [viewName, fileName] of VIEWS) {
    const filePath = `${DATA_DIR}/${fileName}`;
    if (!existsSync(filePath)) {
      missing.push(fileName);
      continue;
    }
    try {
      await db.run(`CREATE OR REPLACE VIEW ${viewName} AS SELECT * FROM read_parquet('${filePath}')`);
      created.push(viewName);
    } catch (err) {
      console.error(`Failed to create view ${viewName}:`, err);
      missing.push(fileName);
    }
  }

  if (created.length > 0) {
    console.log("Views created:", created.join(", "));
  }
  if (missing.length > 0) {
    console.warn("Missing data files:", missing.join(", "));
    console.warn("Upload files to", DATA_DIR, "and call POST /reload to register them.");
  }

  // Ready if at least the core Medicaid view is loaded
  viewsReady = created.includes("claims");
}

export async function reloadViews(): Promise<{ created: string[]; missing: string[] }> {
  if (!db) throw new Error("DuckDB not initialized");

  const missing: string[] = [];
  const created: string[] = [];

  for (const [viewName, fileName] of VIEWS) {
    const filePath = `${DATA_DIR}/${fileName}`;
    if (!existsSync(filePath)) {
      missing.push(fileName);
      continue;
    }
    try {
      await db.run(`CREATE OR REPLACE VIEW ${viewName} AS SELECT * FROM read_parquet('${filePath}')`);
      created.push(viewName);
    } catch (err) {
      console.error(`Failed to create view ${viewName}:`, err);
      missing.push(fileName);
    }
  }

  viewsReady = created.includes("claims");
  return { created, missing };
}

export function isReady(): boolean {
  return viewsReady;
}

export async function executeSQL(
  sql: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!db) {
    throw new Error("DuckDB not initialized");
  }

  if (!viewsReady) {
    throw new Error("Data files not loaded. Upload Parquet files and call POST /reload.");
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
        () => reject(new Error("Query timed out — the dataset is large and this query may need simplification.")),
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
