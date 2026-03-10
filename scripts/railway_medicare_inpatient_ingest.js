// Ingest Medicare Inpatient Hospitals by Provider and Service data (2013-2023)
// into Railway DuckDB as Parquet files.
//
// Run on Railway via: railway ssh, then execute this script with node.
// Or run locally with duckdb-async installed if writing to /data.
//
// Data source: https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service

const { Database } = require("duckdb-async");
(async () => {
  const db = await Database.create(":memory:");
  await db.run("INSTALL httpfs; LOAD httpfs;");

  const years = [
    [2013, "https://data.cms.gov/sites/default/files/2023-05/3748379f-baf7-494d-abb7-653fc85176a3/MUP_IHP_RY23_P03_V10_DY13_PRVSVC.CSV"],
    [2014, "https://data.cms.gov/sites/default/files/2023-05/dd6961c6-0eed-4a33-8527-8f66638819b8/MUP_IHP_RY23_P03_V10_DY14_PRVSVC.CSV"],
    [2015, "https://data.cms.gov/sites/default/files/2023-05/81895338-4c5c-4ad7-a490-8e5a9a972825/MUP_IHP_RY23_P03_V10_DY15_PRVSVC.CSV"],
    [2016, "https://data.cms.gov/sites/default/files/2023-05/4f20bce0-607a-46c1-bd0d-78021b0624ec/MUP_IHP_RY23_P03_V10_DY16_PRVSVC.CSV"],
    [2017, "https://data.cms.gov/sites/default/files/2023-05/ec9287b0-68e6-4818-8c64-3a0c68fcde49/MUP_IHP_RY23_P03_V10_DY17_PRVSVC.CSV"],
    [2018, "https://data.cms.gov/sites/default/files/2023-05/78d80cf4-fc5b-40db-8e88-ca44bc86102f/MUP_IHP_RY23_P03_V10_DY18_PRVSVC.CSV"],
    [2019, "https://data.cms.gov/sites/default/files/2023-05/6602e715-b301-4a38-954d-b8d5aec12b87/MUP_IHP_RY23_P03_V10_DY19_PRVSVC.CSV"],
    [2020, "https://data.cms.gov/sites/default/files/2023-05/e57818f2-318c-4979-a612-c91eba44b011/MUP_IHP_RY23_P03_V10_DY20_PRVSVC.CSV"],
    [2021, "https://data.cms.gov/sites/default/files/2023-05/a754bf0b-0c51-4daf-876e-272f90a11c05/MUP_IHP_RY23_P03_V10_DY21_PRVSVC.CSV"],
    [2022, "https://data.cms.gov/sites/default/files/2024-05/7d1f4bcd-7dd9-4fd1-aa7f-91cd69e452d3/MUP_INP_RY24_P03_V10_DY22_PrvSvc.CSV"],
    [2023, "https://data.cms.gov/sites/default/files/2025-05/ca1c9013-8c7c-4560-a4a1-28cf7e43ccc8/MUP_INP_RY25_P03_V10_DY23_PrvSvc.CSV"],
  ];

  const cols = "Rndrng_Prvdr_CCN, Rndrng_Prvdr_Org_Name, Rndrng_Prvdr_City, Rndrng_Prvdr_St, Rndrng_Prvdr_State_FIPS, Rndrng_Prvdr_Zip5, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_RUCA, Rndrng_Prvdr_RUCA_Desc, DRG_Cd, DRG_Desc, Tot_Dschrgs, Avg_Submtd_Cvrd_Chrg, Avg_Tot_Pymt_Amt, Avg_Mdcr_Pymt_Amt";

  for (const [year, url] of years) {
    const outFile = "/data/inpatient_" + year + ".parquet";
    // Check if already downloaded
    try {
      const check = await db.all("SELECT COUNT(*) as cnt FROM read_parquet('" + outFile + "')");
      console.log(year + " already exists: " + check[0].cnt + " rows, skipping");
      continue;
    } catch (e) {
      // File doesn't exist, proceed
    }

    console.log("Downloading " + year + "...");
    const start = Date.now();
    // ignore_errors=true handles non-UTF-8 characters in some hospital names (e.g. special dashes)
    const sql = "COPY (SELECT " + cols + ", " + year + " AS data_year FROM read_csv_auto('" + url + "', types={'Rndrng_Prvdr_CCN': 'VARCHAR', 'DRG_Cd': 'VARCHAR', 'Rndrng_Prvdr_State_FIPS': 'VARCHAR', 'Rndrng_Prvdr_Zip5': 'VARCHAR', 'Rndrng_Prvdr_RUCA': 'VARCHAR'}, ignore_errors=true)) TO '" + outFile + "' (FORMAT PARQUET, COMPRESSION SNAPPY)";
    await db.run(sql);
    const r = await db.all("SELECT COUNT(*) as cnt FROM read_parquet('" + outFile + "')");
    console.log(year + " done: " + r[0].cnt + " rows (" + Math.round((Date.now()-start)/1000) + "s)");
  }

  // Verify all files
  console.log("\nVerifying all files...");
  let grandTotal = 0;
  for (const [year] of years) {
    const f = "/data/inpatient_" + year + ".parquet";
    try {
      const r = await db.all("SELECT COUNT(*) as cnt FROM read_parquet('" + f + "')");
      console.log("  " + year + ": " + r[0].cnt + " rows");
      grandTotal += Number(r[0].cnt);
    } catch (e) {
      console.error("  " + year + ": MISSING");
    }
  }
  console.log("Total rows across all years: " + grandTotal);

  await db.close();
  console.log("\nDone! Files: /data/inpatient_*.parquet");
})().catch(e => { console.error(e); process.exit(1); });
