"""Pre-aggregate provider-level data from raw Medicaid Parquet for fast detail page lookups."""

import duckdb
import os
import time

RAW = os.path.join(os.path.dirname(__file__), "..", "medicaid-provider-spending.parquet")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "provider-aggregates")

os.makedirs(OUT, exist_ok=True)
con = duckdb.connect()

start = time.time()


def write_parquet(name: str, sql: str):
    t = time.time()
    con.sql(f"COPY ({sql}) TO '{OUT}/{name}.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY)")
    rows = con.sql(f"SELECT count(*) FROM '{OUT}/{name}.parquet'").fetchone()[0]
    size = os.path.getsize(f"{OUT}/{name}.parquet")
    print(f"  {name}.parquet — {rows:,} rows, {size / 1e6:.1f} MB ({time.time() - t:.1f}s)")
    return rows


# ---------------------------------------------------------------------------
# 1. provider_stats — 1 row per provider (~617K rows)
# ---------------------------------------------------------------------------
print("\n[1/3] provider_stats")
write_parquet("provider_stats", f"""
    SELECT
        billing_npi,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT hcpcs_code)::INT AS procedures_billed,
        MIN(claim_month) AS first_month,
        MAX(claim_month) AS last_month
    FROM '{RAW}'
    GROUP BY billing_npi
""")

# ---------------------------------------------------------------------------
# 2. provider_hcpcs — per-provider procedure totals (~12M rows)
# ---------------------------------------------------------------------------
print("\n[2/3] provider_hcpcs")
write_parquet("provider_hcpcs", f"""
    SELECT
        billing_npi,
        hcpcs_code,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries
    FROM '{RAW}'
    GROUP BY billing_npi, hcpcs_code
""")

# ---------------------------------------------------------------------------
# 3. provider_monthly — per-provider monthly trend (~20M rows)
# ---------------------------------------------------------------------------
print("\n[3/3] provider_monthly")
write_parquet("provider_monthly", f"""
    SELECT
        billing_npi,
        claim_month,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims
    FROM '{RAW}'
    GROUP BY billing_npi, claim_month
    ORDER BY billing_npi, claim_month
""")

elapsed = time.time() - start
print(f"\nAll done in {elapsed:.0f}s")

# Print total output size
total = sum(
    os.path.getsize(os.path.join(OUT, f))
    for f in os.listdir(OUT)
    if os.path.isfile(os.path.join(OUT, f))
)
print(f"Total output size: {total / 1e6:.1f} MB")
