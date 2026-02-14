"""Convert the Medicaid provider spending CSV to Parquet for fast querying."""

import duckdb
import time

CSV_PATH = "medicaid-provider-spending.csv"
PARQUET_PATH = "medicaid-provider-spending.parquet"

print(f"Converting {CSV_PATH} → {PARQUET_PATH} ...")
start = time.time()

duckdb.sql(f"""
    COPY (
        SELECT
            BILLING_PROVIDER_NPI_NUM::VARCHAR   AS billing_npi,
            SERVICING_PROVIDER_NPI_NUM::VARCHAR AS servicing_npi,
            HCPCS_CODE::VARCHAR                 AS hcpcs_code,
            CAST(CLAIM_FROM_MONTH || '-01' AS DATE) AS claim_month,
            TOTAL_UNIQUE_BENEFICIARIES::INT     AS unique_beneficiaries,
            TOTAL_CLAIMS::INT                   AS total_claims,
            TOTAL_PAID::DOUBLE                  AS total_paid
        FROM read_csv('{CSV_PATH}', auto_detect=true)
    ) TO '{PARQUET_PATH}' (FORMAT PARQUET, COMPRESSION ZSTD)
""")

elapsed = time.time() - start
import os
size_gb = round(os.path.getsize(PARQUET_PATH) / 1e9, 2)

rows = duckdb.sql(f"SELECT count(*) FROM '{PARQUET_PATH}'").fetchone()[0]

print(f"Done in {elapsed:.0f}s — {rows:,} rows, {size_gb} GB")
