"""
Download CMS Medicare Part D Prescribers (by Provider and Drug) CSVs
and convert each year to Parquet.

Source: https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug

Each row = one prescriber (NPI) + one drug (brand/generic name) for a given year.
~25M rows/year, 11 years (2013-2023), ~276M total.

Usage:
    source .venv/bin/activate
    python scripts/ingest_partd.py
"""

import duckdb
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

# CSV URLs from data.cms.gov via catalog.data.gov (all verified)
YEARS = {
    2023: "https://data.cms.gov/sites/default/files/2025-04/0d5915ce-002c-4d87-bde8-24ffb08bb6cc/MUP_DPR_RY25_P04_V10_DY23_NPIBN.csv",
    2022: "https://data.cms.gov/sites/default/files/2024-05/18f82097-61a6-4889-9941-9a0b6ad7523c/MUP_DPR_RY24_P04_V10_DY22_NPIBN.csv",
    2021: "https://data.cms.gov/sites/default/files/2024-05/43359391-e7fa-40b9-9bd4-5dc295e18712/MUP_DPR_RY24_P04_V10_DY21_NPIBN.csv",
    2020: "https://data.cms.gov/sites/default/files/2024-05/75fecc51-c9e8-4904-b570-9da9dc101721/MUP_DPR_RY24_P04_V10_DY20_NPIBN.csv",
    2019: "https://data.cms.gov/sites/default/files/2024-05/129e7c21-d492-425b-be03-d2e59d933ab6/MUP_DPR_RY24_P04_V10_DY19_NPIBN.csv",
    2018: "https://data.cms.gov/sites/default/files/2024-05/be3019b4-1164-4b40-af5d-cab40847d222/MUP_DPR_RY24_P04_V10_DY18_NPIBN.csv",
    2017: "https://data.cms.gov/sites/default/files/2024-05/d9d685a0-dc49-4da5-9416-4cf3e6349296/MUP_DPR_RY24_P04_V10_DY17_NPIBN.csv",
    2016: "https://data.cms.gov/sites/default/files/2024-05/67c457c6-b62d-424f-ad85-2bb8117c928d/MUP_DPR_RY24_P04_V10_DY16_NPIBN.csv",
    2015: "https://data.cms.gov/sites/default/files/2024-05/bc1caf7f-dcbb-4258-b243-ee3666b6a20b/MUP_DPR_RY24_P04_V10_DY15_NPIBN.csv",
    2014: "https://data.cms.gov/sites/default/files/2024-05/06e87540-68a5-4a10-bf9c-a0521dc4ebed/MUP_DPR_RY24_P04_V10_DY14_NPIBN.csv",
    2013: "https://data.cms.gov/sites/default/files/2024-05/5fb694b1-2ec5-4e00-8efe-14161bdbdbea/MUP_DPR_RY24_P04_V10_DY13_NPIBN.csv",
}

COLUMN_SELECT = """
    CAST(Prscrbr_NPI AS VARCHAR) AS Prscrbr_NPI,
    Prscrbr_Last_Org_Name,
    Prscrbr_First_Name,
    Prscrbr_City,
    Prscrbr_State_Abrvtn,
    CAST(Prscrbr_State_FIPS AS VARCHAR) AS Prscrbr_State_FIPS,
    Prscrbr_Type,
    Prscrbr_Type_Src,
    Brnd_Name,
    Gnrc_Name,
    CAST(Tot_Clms AS BIGINT) AS Tot_Clms,
    CAST(Tot_30day_Fills AS DOUBLE) AS Tot_30day_Fills,
    CAST(Tot_Day_Suply AS BIGINT) AS Tot_Day_Suply,
    CAST(Tot_Drug_Cst AS DOUBLE) AS Tot_Drug_Cst,
    CAST(Tot_Benes AS BIGINT) AS Tot_Benes,
    GE65_Sprsn_Flag,
    CAST(GE65_Tot_Clms AS BIGINT) AS GE65_Tot_Clms,
    CAST(GE65_Tot_30day_Fills AS DOUBLE) AS GE65_Tot_30day_Fills,
    CAST(GE65_Tot_Day_Suply AS BIGINT) AS GE65_Tot_Day_Suply,
    CAST(GE65_Tot_Drug_Cst AS DOUBLE) AS GE65_Tot_Drug_Cst,
    GE65_Bene_Sprsn_Flag,
    CAST(GE65_Tot_Benes AS BIGINT) AS GE65_Tot_Benes,
    {year} AS data_year
"""


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET force_download=true;")

    total_rows = 0

    for year, url in sorted(YEARS.items()):
        output_file = os.path.join(OUTPUT_DIR, f"partd_{year}.parquet")
        print(f"\n--- {year} ---")
        print(f"Downloading from: {url}")

        cols = COLUMN_SELECT.format(year=year)
        con.execute(f"""
            COPY (
                SELECT {cols}
                FROM read_csv_auto('{url}', header=true, all_varchar=true, ignore_errors=true)
            ) TO '{output_file}' (FORMAT PARQUET, COMPRESSION SNAPPY)
        """)

        count = con.execute(
            f"SELECT COUNT(*) FROM read_parquet('{output_file}')"
        ).fetchone()[0]
        size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"  Rows: {count:,}  |  Size: {size_mb:.1f} MB")
        total_rows += count

    print(f"\n{'='*50}")
    print(f"Total rows: {total_rows:,}")

    # Verify the first file's schema
    sample_file = os.path.join(OUTPUT_DIR, "partd_2023.parquet")
    cols = con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{sample_file}')"
    ).fetchall()
    print(f"\nColumns ({len(cols)}):")
    for col in cols:
        print(f"  {col[0]:30s} {col[1]}")

    # Top drugs
    drugs = con.execute(f"""
        SELECT Gnrc_Name, SUM(Tot_Clms) as claims
        FROM read_parquet('{sample_file}')
        GROUP BY Gnrc_Name
        ORDER BY claims DESC
        LIMIT 10
    """).fetchall()
    print("\nTop 10 drugs by claims (2023):")
    for d in drugs:
        print(f"  {d[0]:40s} {d[1]:>12,}")

    con.close()


if __name__ == "__main__":
    main()
