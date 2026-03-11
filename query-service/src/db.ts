import { Database } from "duckdb-async";
import { existsSync, readdirSync } from "fs";

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
  ["medicare", "medicare_*.parquet"],
  ["medicare_inpatient", "inpatient_*.parquet"],
  ["nhanes", "nhanes_2021_2023.parquet"],
  ["dac", "dac_clinicians.parquet"],
];

export async function initDB(): Promise<void> {
  if (db) return;

  db = await Database.create(":memory:");

  // Try to register views — skip missing files gracefully
  await tryCreateViews();
}

// Medicare Part B physician view needs explicit column list with CAST for NPI
const MEDICARE_PHYSICIAN_COLS = `CAST(Rndrng_NPI AS VARCHAR) AS Rndrng_NPI, Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name, Rndrng_Prvdr_MI, Rndrng_Prvdr_Crdntls, Rndrng_Prvdr_Ent_Cd, Rndrng_Prvdr_St1, Rndrng_Prvdr_St2, Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_State_FIPS, Rndrng_Prvdr_Zip5, Rndrng_Prvdr_RUCA, Rndrng_Prvdr_RUCA_Desc, Rndrng_Prvdr_Cntry, Rndrng_Prvdr_Type, Rndrng_Prvdr_Mdcr_Prtcptg_Ind, HCPCS_Cd, HCPCS_Desc, HCPCS_Drug_Ind, Place_Of_Srvc, Tot_Benes, Tot_Srvcs, Tot_Bene_Day_Srvcs, Avg_Sbmtd_Chrg, Avg_Mdcr_Alowd_Amt, Avg_Mdcr_Pymt_Amt, Avg_Mdcr_Stdzd_Amt, data_year`;

// Map view names to explicit column lists (for views that need special handling)
const GLOB_VIEW_COLUMNS: Record<string, string> = {
  medicare: MEDICARE_PHYSICIAN_COLS,
};

function buildGlobViewSQL(viewName: string, filePath: string): string {
  const cols = GLOB_VIEW_COLUMNS[viewName];
  if (cols) {
    return `CREATE OR REPLACE VIEW ${viewName} AS SELECT ${cols} FROM read_parquet('${filePath}', union_by_name=true)`;
  }
  return `CREATE OR REPLACE VIEW ${viewName} AS SELECT * FROM read_parquet('${filePath}', union_by_name=true)`;
}

async function tryCreateViews(): Promise<void> {
  if (!db) return;

  const missing: string[] = [];
  const created: string[] = [];

  for (const [viewName, fileName] of VIEWS) {
    const filePath = `${DATA_DIR}/${fileName}`;
    const isGlob = fileName.includes("*");

    // For glob patterns, check if any files match
    if (isGlob) {
      const pattern = new RegExp("^" + fileName.replace(/\*/g, ".*") + "$");
      const matches = readdirSync(DATA_DIR).filter((f) => pattern.test(f));
      if (matches.length === 0) {
        missing.push(fileName);
        continue;
      }
      try {
        await db.run(buildGlobViewSQL(viewName, filePath));
        created.push(viewName);
        console.log(`  ${viewName}: ${matches.length} files matched glob`);
      } catch (err) {
        console.error(`Failed to create view ${viewName}:`, err);
        missing.push(fileName);
      }
      continue;
    }

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
    const isGlob = fileName.includes("*");

    if (isGlob) {
      const pattern = new RegExp("^" + fileName.replace(/\*/g, ".*") + "$");
      const matches = readdirSync(DATA_DIR).filter((f) => pattern.test(f));
      if (matches.length === 0) {
        missing.push(fileName);
        continue;
      }
      try {
        await db.run(buildGlobViewSQL(viewName, filePath));
        created.push(viewName);
        console.log(`  ${viewName}: ${matches.length} files matched glob`);
      } catch (err) {
        console.error(`Failed to create view ${viewName}:`, err);
        missing.push(fileName);
      }
      continue;
    }

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
