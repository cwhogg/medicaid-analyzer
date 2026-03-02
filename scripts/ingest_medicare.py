"""
Download CMS Medicare Physician & Other Practitioners data (2023)
and convert to Parquet with snappy compression.

Usage:
    source .venv/bin/activate
    python scripts/ingest_medicare.py
"""

import duckdb
import os
import sys

# 2023 CSV direct download (no auth required)
# If this URL 404s, visit https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service
# and grab the current CSV download link.
CSV_URL = "https://data.cms.gov/sites/default/files/2025-04/e3f823f8-db5b-4cc7-ba04-e7ae92b99757/MUP_PHY_R25_P05_V20_D23_Prov_Svc.csv"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "medicare_physician_2023.parquet")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    con = duckdb.connect()

    # Check if we have a local CSV first (faster than re-downloading 3GB)
    local_csv = os.path.join(OUTPUT_DIR, "medicare_2023.csv")
    if os.path.exists(local_csv):
        print(f"Using local CSV: {local_csv}")
        source = local_csv
    else:
        print(f"Downloading from CMS (this is ~3GB, may take a few minutes)...")
        source = CSV_URL

    print("Converting to Parquet...")
    con.execute(f"""
        COPY (
            SELECT
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
                Avg_Mdcr_Stdzd_Amt,
                2023 AS data_year
            FROM read_csv_auto('{source}')
        ) TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    """)

    # Verify
    result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUTPUT_FILE}')").fetchone()
    print(f"Rows: {result[0]:,}")

    # Show columns
    cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{OUTPUT_FILE}')").fetchall()
    print(f"\nColumns ({len(cols)}):")
    for col in cols:
        print(f"  {col[0]:40s} {col[1]}")

    # File size
    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nOutput: {OUTPUT_FILE}")
    print(f"Size: {size_mb:.1f} MB")

    # Sample data
    print("\nSample row:")
    row = con.execute(f"SELECT * FROM read_parquet('{OUTPUT_FILE}') LIMIT 1").fetchdf()
    for col_name in row.columns:
        print(f"  {col_name}: {row[col_name].iloc[0]}")

    con.close()

if __name__ == "__main__":
    main()
