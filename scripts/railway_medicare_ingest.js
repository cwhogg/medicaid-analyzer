const { Database } = require("duckdb-async");
(async () => {
  const db = await Database.create(":memory:");
  await db.run("INSTALL httpfs; LOAD httpfs;");

  const cols = "Rndrng_NPI, Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name, Rndrng_Prvdr_MI, Rndrng_Prvdr_Crdntls, Rndrng_Prvdr_Ent_Cd, Rndrng_Prvdr_St1, Rndrng_Prvdr_St2, Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_State_FIPS, Rndrng_Prvdr_Zip5, Rndrng_Prvdr_RUCA, Rndrng_Prvdr_RUCA_Desc, Rndrng_Prvdr_Cntry, Rndrng_Prvdr_Type, Rndrng_Prvdr_Mdcr_Prtcptg_Ind, HCPCS_Cd, HCPCS_Desc, HCPCS_Drug_Ind, Place_Of_Srvc, Tot_Benes, Tot_Srvcs, Tot_Bene_Day_Srvcs, Avg_Sbmtd_Chrg, Avg_Mdcr_Alowd_Amt, Avg_Mdcr_Pymt_Amt, Avg_Mdcr_Stdzd_Amt";

  const years = [
    [2013, "https://data.cms.gov/sites/default/files/2025-11/bf4231f9-ec7f-4189-afc3-ba5d53b8bd12/MUP_PHY_R25_P04_V20_D13_Prov_Svc.csv"],
    [2014, "https://data.cms.gov/sites/default/files/2025-11/6700f86d-d2e5-4f2d-9dcb-8c30412768ff/MUP_PHY_R25_P04_V20_D14_Prov_Svc.csv"],
    [2015, "https://data.cms.gov/sites/default/files/2025-11/14954ce3-4c43-43df-97e9-2c0437d7b43c/MUP_PHY_R25_P04_V20_D15_Prov_Svc.csv"],
    [2016, "https://data.cms.gov/sites/default/files/2025-11/426bf97a-4cb8-47ca-9727-a535d9e8c298/MUP_PHY_R25_P04_V20_D16_Prov_Svc.csv"],
    [2017, "https://data.cms.gov/sites/default/files/2025-11/4623fb40-781e-4eef-860e-b851cd5d10ea/MUP_PHY_R25_P04_V20_D17_Prov_Svc.csv"],
    [2018, "https://data.cms.gov/sites/default/files/2025-11/5669eafb-f0b3-4dc5-be6d-abc09b480c2e/MUP_PHY_R25_P04_V20_D18_Prov_Svc.csv"],
    [2019, "https://data.cms.gov/sites/default/files/2025-11/7befba27-752e-47a8-a76c-6c6d4f74f2e3/MUP_PHY_R25_P04_V20_D19_Prov_Svc.csv"],
    [2020, "https://data.cms.gov/sites/default/files/2025-11/d22b18cd-7726-4bf5-8e9c-3e4587c589a1/MUP_PHY_R25_P05_V20_D20_Prov_Svc.csv"],
    [2021, "https://data.cms.gov/sites/default/files/2025-11/bffaf97a-c2ab-4fd7-8718-be90742e3485/MUP_PHY_R25_P05_V20_D21_Prov_Svc.csv"],
    [2022, "https://data.cms.gov/sites/default/files/2025-11/53fb2bae-4913-48dc-a6d4-d8c025906567/MUP_PHY_R25_P05_V20_D22_Prov_Svc.csv"],
  ];

  for (const [year, url] of years) {
    const outFile = "/data/medicare_" + year + ".parquet";
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
    const sql = "COPY (SELECT " + cols + ", " + year + " AS data_year FROM read_csv_auto('" + url + "', types={'Rndrng_NPI': 'VARCHAR'})) TO '" + outFile + "' (FORMAT PARQUET, COMPRESSION SNAPPY)";
    await db.run(sql);
    const r = await db.all("SELECT COUNT(*) as cnt FROM read_parquet('" + outFile + "')");
    console.log(year + " done: " + r[0].cnt + " rows (" + Math.round((Date.now()-start)/1000) + "s)");
  }

  // Combine all years (2013-2022 temp files + existing 2023 file)
  console.log("\nCombining all years into single file...");
  const combineStart = Date.now();

  // Build list of all parquet files to combine
  const allFiles = years.map(([y]) => "'/data/medicare_" + y + ".parquet'").join(", ");
  const combineSql = "COPY (SELECT CAST(Rndrng_NPI AS VARCHAR) AS Rndrng_NPI, Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name, Rndrng_Prvdr_MI, Rndrng_Prvdr_Crdntls, Rndrng_Prvdr_Ent_Cd, Rndrng_Prvdr_St1, Rndrng_Prvdr_St2, Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_State_FIPS, Rndrng_Prvdr_Zip5, Rndrng_Prvdr_RUCA, Rndrng_Prvdr_RUCA_Desc, Rndrng_Prvdr_Cntry, Rndrng_Prvdr_Type, Rndrng_Prvdr_Mdcr_Prtcptg_Ind, HCPCS_Cd, HCPCS_Desc, HCPCS_Drug_Ind, Place_Of_Srvc, Tot_Benes, Tot_Srvcs, Tot_Bene_Day_Srvcs, Avg_Sbmtd_Chrg, Avg_Mdcr_Alowd_Amt, Avg_Mdcr_Pymt_Amt, Avg_Mdcr_Stdzd_Amt, data_year FROM read_parquet([" + allFiles + ", '/data/medicare_physician_2023.parquet'], union_by_name=true)) TO '/data/medicare_physician_all_years.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY, ROW_GROUP_SIZE 500000)";
  await db.run(combineSql);

  const total = await db.all("SELECT data_year, COUNT(*) as cnt FROM read_parquet('/data/medicare_physician_all_years.parquet') GROUP BY data_year ORDER BY data_year");
  console.log("Combined! (" + Math.round((Date.now()-combineStart)/1000) + "s)");
  for (const r of total) { console.log("  " + r.data_year + ": " + r.cnt + " rows"); }
  const grandTotal = await db.all("SELECT COUNT(*) as cnt FROM read_parquet('/data/medicare_physician_all_years.parquet')");
  console.log("Total rows: " + grandTotal[0].cnt);

  // Clean up temp per-year files
  console.log("\nCleaning up temp files...");
  const fs = require("fs");
  for (const [year] of years) {
    const f = "/data/medicare_" + year + ".parquet";
    try { fs.unlinkSync(f); console.log("  Deleted " + f); } catch(e) {}
  }
  // Delete old single-year file
  try { fs.unlinkSync("/data/medicare_physician_2023.parquet"); console.log("  Deleted old 2023 file"); } catch(e) {}

  console.log("\nDone! Final file: /data/medicare_physician_all_years.parquet");
  await db.close();
})().catch(e => { console.error(e); process.exit(1); });
