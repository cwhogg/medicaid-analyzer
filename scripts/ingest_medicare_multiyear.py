"""
Download CMS Medicare Physician & Other Practitioners data for ALL years (2013-2023)
and combine into a single Parquet file with a data_year column.

All years have identical column schemas (29 columns). Each year is ~9-10M rows.
Combined: ~100M+ rows, estimated ~3-4GB Parquet.

Usage:
    source .venv/bin/activate
    python scripts/ingest_medicare_multiyear.py

Source: https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/
        medicare-physician-other-practitioners-by-provider-and-service
"""

import duckdb
import os
import sys

# Direct download URLs for each year — if a URL 404s, visit the CMS page above
# and grab the updated CSV download link for that year.
YEAR_URLS = {
    2013: "https://data.cms.gov/sites/default/files/2025-11/bf4231f9-ec7f-4189-afc3-ba5d53b8bd12/MUP_PHY_R25_P04_V20_D13_Prov_Svc.csv",
    2014: "https://data.cms.gov/sites/default/files/2025-11/6700f86d-d2e5-4f2d-9dcb-8c30412768ff/MUP_PHY_R25_P04_V20_D14_Prov_Svc.csv",
    2015: "https://data.cms.gov/sites/default/files/2025-11/14954ce3-4c43-43df-97e9-2c0437d7b43c/MUP_PHY_R25_P04_V20_D15_Prov_Svc.csv",
    2016: "https://data.cms.gov/sites/default/files/2025-11/426bf97a-4cb8-47ca-9727-a535d9e8c298/MUP_PHY_R25_P04_V20_D16_Prov_Svc.csv",
    2017: "https://data.cms.gov/sites/default/files/2025-11/4623fb40-781e-4eef-860e-b851cd5d10ea/MUP_PHY_R25_P04_V20_D17_Prov_Svc.csv",
    2018: "https://data.cms.gov/sites/default/files/2025-11/5669eafb-f0b3-4dc5-be6d-abc09b480c2e/MUP_PHY_R25_P04_V20_D18_Prov_Svc.csv",
    2019: "https://data.cms.gov/sites/default/files/2025-11/7befba27-752e-47a8-a76c-6c6d4f74f2e3/MUP_PHY_R25_P04_V20_D19_Prov_Svc.csv",
    2020: "https://data.cms.gov/sites/default/files/2025-11/d22b18cd-7726-4bf5-8e9c-3e4587c589a1/MUP_PHY_R25_P04_V20_D20_Prov_Svc.csv",
    2021: "https://data.cms.gov/sites/default/files/2025-11/bffaf97a-c2ab-4fd7-8718-be90742e3485/MUP_PHY_R25_P04_V20_D21_Prov_Svc.csv",
    2022: "https://data.cms.gov/sites/default/files/2025-11/53fb2bae-4913-48dc-a6d4-d8c025906567/MUP_PHY_R25_P05_V20_D22_Prov_Svc.csv",
    2023: "https://data.cms.gov/sites/default/files/2025-04/e3f823f8-db5b-4cc7-ba04-e7ae92b99757/MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv",
}

# Columns to select (identical across all years)
COLUMNS = """
    CAST(Rndrng_NPI AS VARCHAR) AS Rndrng_NPI,
    Rndrng_Prvdr_Last_Org_Name,
    Rndrng_Prvdr_First_Name,
    Rndrng_Prvdr_MI,
    Rndrng_Prvdr_Crdntls,
    Rndrng_Prvdr_Ent_Cd,
    Rndrng_Prvdr_St1,
    Rndrng_Prvdr_St2,
    Rndrng_Prvdr_City,
    Rndrng_Prvdr_State_Abrvtn,
    Rndrng_Prvdr_State_FIPS,
    Rndrng_Prvdr_Zip5,
    Rndrng_Prvdr_RUCA,
    Rndrng_Prvdr_RUCA_Desc,
    Rndrng_Prvdr_Cntry,
    Rndrng_Prvdr_Type,
    Rndrng_Prvdr_Mdcr_Prtcptg_Ind,
    HCPCS_Cd,
    HCPCS_Desc,
    HCPCS_Drug_Ind,
    Place_Of_Srvc,
    Tot_Benes,
    Tot_Srvcs,
    Tot_Bene_Day_Srvcs,
    Avg_Sbmtd_Chrg,
    Avg_Mdcr_Alowd_Amt,
    Avg_Mdcr_Pymt_Amt,
    Avg_Mdcr_Stdzd_Amt
"""

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "medicare_physician_all_years.parquet")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Allow specifying subset of years via command line
    if len(sys.argv) > 1:
        years = [int(y) for y in sys.argv[1:]]
    else:
        years = sorted(YEAR_URLS.keys())

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")

    # Build UNION ALL query across all years
    union_parts = []
    for year in years:
        url = YEAR_URLS[year]
        union_parts.append(f"""
            SELECT {COLUMNS}, {year} AS data_year
            FROM read_csv_auto('{url}')
        """)

    union_query = " UNION ALL ".join(union_parts)

    print(f"Combining {len(years)} years: {min(years)}-{max(years)}")
    print("This downloads ~30GB of CSVs and writes a single Parquet. May take 30-60 minutes...")

    con.execute(f"""
        COPY ({union_query})
        TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY, ROW_GROUP_SIZE 500000)
    """)

    # Verify
    result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUTPUT_FILE}')").fetchone()
    print(f"\nTotal rows: {result[0]:,}")

    # Per-year breakdown
    print("\nRows per year:")
    year_counts = con.execute(f"""
        SELECT data_year, COUNT(*) as cnt
        FROM read_parquet('{OUTPUT_FILE}')
        GROUP BY data_year ORDER BY data_year
    """).fetchall()
    for year, cnt in year_counts:
        print(f"  {year}: {cnt:,}")

    # Columns
    cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{OUTPUT_FILE}')").fetchall()
    print(f"\nColumns ({len(cols)}):")
    for col in cols:
        print(f"  {col[0]:40s} {col[1]}")

    # File size
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nOutput: {OUTPUT_FILE}")
    print(f"Size: {size_mb:.1f} MB ({size_mb/1024:.2f} GB)")

    con.close()


if __name__ == "__main__":
    main()
