"""
Download CMS DAC (Doctors and Clinicians) National Downloadable File
and convert to Parquet.

Source: https://data.cms.gov/provider-data/dataset/mj5m-pzi6
Download: https://data.cms.gov/provider-data/sites/default/files/resources/52c3f098d7e56028a298fd297cb0b38d_1771632339/DAC_NationalDownloadableFile.csv

Each row = clinician/enrollment/group/address combination.
Clinicians with multiple enrollments or locations appear on multiple rows.

Usage:
    source .venv/bin/activate
    python scripts/ingest_dac.py
"""

import duckdb
import os

SOURCE_URL = "https://data.cms.gov/provider-data/sites/default/files/resources/52c3f098d7e56028a298fd297cb0b38d_1771632339/DAC_NationalDownloadableFile.csv"

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "dac_clinicians.parquet")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    con = duckdb.connect()

    # Enable httpfs for remote CSV reads
    con.execute("INSTALL httpfs; LOAD httpfs;")
    con.execute("SET force_download=true;")

    print("Downloading and converting to Parquet...")
    con.execute(f"""
        COPY (
            SELECT
                CAST(NPI AS VARCHAR) AS npi,
                CAST(Ind_PAC_ID AS VARCHAR) AS ind_pac_id,
                CAST(Ind_enrl_ID AS VARCHAR) AS ind_enrl_id,
                "Provider Last Name" AS provider_last_name,
                "Provider First Name" AS provider_first_name,
                "Provider Middle Name" AS provider_middle_name,
                suff,
                gndr,
                Cred AS cred,
                Med_sch AS med_sch,
                CAST(Grd_yr AS VARCHAR) AS grd_yr,
                pri_spec,
                sec_spec_1,
                sec_spec_2,
                sec_spec_3,
                sec_spec_4,
                sec_spec_all,
                Telehlth AS telehlth,
                "Facility Name" AS facility_name,
                CAST(org_pac_id AS VARCHAR) AS org_pac_id,
                CAST(num_org_mem AS INTEGER) AS num_org_mem,
                adr_ln_1,
                adr_ln_2,
                ln_2_sprs,
                "City/Town" AS city,
                State AS state,
                CAST("ZIP Code" AS VARCHAR) AS zip_code,
                "Telephone Number" AS telephone,
                ind_assgn,
                grp_assgn,
                CAST(adrs_id AS VARCHAR) AS adrs_id
            FROM read_csv_auto('{SOURCE_URL}', header=true, all_varchar=true)
        ) TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    """)

    # Verify
    result = con.execute(
        f"SELECT COUNT(*) FROM read_parquet('{OUTPUT_FILE}')"
    ).fetchone()
    print(f"Rows: {result[0]:,}")

    unique_npis = con.execute(
        f"SELECT COUNT(DISTINCT npi) FROM read_parquet('{OUTPUT_FILE}')"
    ).fetchone()
    print(f"Unique NPIs: {unique_npis[0]:,}")

    cols = con.execute(
        f"DESCRIBE SELECT * FROM read_parquet('{OUTPUT_FILE}')"
    ).fetchall()
    print(f"\nColumns ({len(cols)}):")
    for col in cols:
        print(f"  {col[0]:40s} {col[1]}")

    # Sample specialties
    specs = con.execute(f"""
        SELECT pri_spec, COUNT(*) as cnt
        FROM read_parquet('{OUTPUT_FILE}')
        GROUP BY pri_spec
        ORDER BY cnt DESC
        LIMIT 15
    """).fetchall()
    print("\nTop specialties:")
    for s in specs:
        print(f"  {s[0]:40s} {s[1]:>10,}")

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nFile size: {size_mb:.1f} MB")
    con.close()


if __name__ == "__main__":
    main()
