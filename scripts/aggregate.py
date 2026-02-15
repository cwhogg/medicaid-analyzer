"""Pre-aggregate the raw Medicaid Parquet into summary tables for the web app."""

import duckdb
import json
import os
import time

RAW = os.path.join(os.path.dirname(__file__), "..", "medicaid-provider-spending.parquet")
OUT = os.path.join(os.path.dirname(__file__), "..", "web", "public", "data")

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


def write_json(name: str, sql: str):
    t = time.time()
    result = con.sql(sql)
    columns = [desc[0] for desc in result.description]
    rows = result.fetchall()
    data = []
    for row in rows:
        record = {}
        for col, val in zip(columns, row):
            if hasattr(val, "isoformat"):
                record[col] = val.isoformat()
            else:
                record[col] = val
        data.append(record)
    path = f"{OUT}/{name}.json"
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = os.path.getsize(path)
    print(f"  {name}.json — {len(data):,} records, {size / 1e3:.1f} KB ({time.time() - t:.1f}s)")


# ---------------------------------------------------------------------------
# 1. monthly_totals — ~84 rows
# ---------------------------------------------------------------------------
print("\n[1/11] monthly_totals")
write_parquet("monthly_totals", f"""
    SELECT
        claim_month,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT billing_npi)::INT AS unique_providers,
        COUNT(DISTINCT hcpcs_code)::INT AS unique_hcpcs_codes
    FROM '{RAW}'
    GROUP BY claim_month
    ORDER BY claim_month
""")

# ---------------------------------------------------------------------------
# 2. hcpcs_summary — ~10.9K rows
# ---------------------------------------------------------------------------
print("\n[2/11] hcpcs_summary")
write_parquet("hcpcs_summary", f"""
    SELECT
        hcpcs_code,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT billing_npi)::INT AS unique_providers,
        MIN(claim_month) AS first_month,
        MAX(claim_month) AS last_month
    FROM '{RAW}'
    GROUP BY hcpcs_code
    ORDER BY SUM(total_paid) DESC
""")

# ---------------------------------------------------------------------------
# 3. hcpcs_monthly — ~900K rows
# ---------------------------------------------------------------------------
print("\n[3/11] hcpcs_monthly")
write_parquet("hcpcs_monthly", f"""
    SELECT
        hcpcs_code,
        claim_month,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT billing_npi)::INT AS unique_providers
    FROM '{RAW}'
    GROUP BY hcpcs_code, claim_month
    ORDER BY hcpcs_code, claim_month
""")

# ---------------------------------------------------------------------------
# 4. provider_summary — ~617K rows
# ---------------------------------------------------------------------------
print("\n[4/11] provider_summary")
write_parquet("provider_summary", f"""
    SELECT
        billing_npi,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT hcpcs_code)::INT AS unique_hcpcs_codes,
        MIN(claim_month) AS first_month,
        MAX(claim_month) AS last_month
    FROM '{RAW}'
    GROUP BY billing_npi
    ORDER BY SUM(total_paid) DESC
""")

# ---------------------------------------------------------------------------
# 5. top_providers_monthly — monthly detail for top 1K providers
# ---------------------------------------------------------------------------
print("\n[5/11] top_providers_monthly")
write_parquet("top_providers_monthly", f"""
    WITH top_providers AS (
        SELECT billing_npi
        FROM '{RAW}'
        GROUP BY billing_npi
        ORDER BY SUM(total_paid) DESC
        LIMIT 1000
    )
    SELECT
        r.billing_npi,
        r.claim_month,
        SUM(r.total_paid)::DOUBLE AS total_paid,
        SUM(r.total_claims)::BIGINT AS total_claims,
        SUM(r.unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT r.hcpcs_code)::INT AS unique_hcpcs_codes
    FROM '{RAW}' r
    INNER JOIN top_providers tp ON r.billing_npi = tp.billing_npi
    GROUP BY r.billing_npi, r.claim_month
    ORDER BY r.billing_npi, r.claim_month
""")

# ---------------------------------------------------------------------------
# 6. provider_hcpcs_summary — yearly spending by provider and HCPCS code
# ---------------------------------------------------------------------------
print("\n[6/11] provider_hcpcs_summary")
write_parquet("provider_hcpcs_summary", f"""
    SELECT
        billing_npi,
        hcpcs_code,
        EXTRACT(YEAR FROM claim_month)::INT AS year,
        SUM(total_paid)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries
    FROM '{RAW}'
    GROUP BY billing_npi, hcpcs_code, EXTRACT(YEAR FROM claim_month)
    HAVING SUM(total_paid) >= 25000
    ORDER BY billing_npi, hcpcs_code, year
""")

# ---------------------------------------------------------------------------
# 7. state_summary — spending aggregated by provider state
# ---------------------------------------------------------------------------
NPI_LOOKUP = f"{OUT}/npi_lookup.parquet"
print("\n[7/11] state_summary")
write_parquet("state_summary", f"""
    SELECT
        n.state,
        SUM(r.total_paid)::DOUBLE AS total_paid,
        SUM(r.total_claims)::BIGINT AS total_claims,
        SUM(r.unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT r.billing_npi)::INT AS unique_providers,
        COUNT(DISTINCT r.hcpcs_code)::INT AS unique_hcpcs_codes
    FROM '{RAW}' r
    INNER JOIN '{NPI_LOOKUP}' n ON r.billing_npi = n.billing_npi
    WHERE n.state IS NOT NULL AND n.state != ''
    GROUP BY n.state
    ORDER BY SUM(r.total_paid) DESC
""")

# ---------------------------------------------------------------------------
# 8. state_hcpcs_summary — top procedures by state
# ---------------------------------------------------------------------------
print("\n[8/11] state_hcpcs_summary")
write_parquet("state_hcpcs_summary", f"""
    SELECT
        n.state,
        r.hcpcs_code,
        SUM(r.total_paid)::DOUBLE AS total_paid,
        SUM(r.total_claims)::BIGINT AS total_claims,
        SUM(r.unique_beneficiaries)::BIGINT AS unique_beneficiaries,
        COUNT(DISTINCT r.billing_npi)::INT AS unique_providers
    FROM '{RAW}' r
    INNER JOIN '{NPI_LOOKUP}' n ON r.billing_npi = n.billing_npi
    WHERE n.state IS NOT NULL AND n.state != ''
    GROUP BY n.state, r.hcpcs_code
    HAVING SUM(r.total_paid) >= 100000
    ORDER BY n.state, SUM(r.total_paid) DESC
""")

# ---------------------------------------------------------------------------
# 9. stats.json — overall summary stats for landing page
# ---------------------------------------------------------------------------
print("\n[9/11] stats.json")
write_json("stats", f"""
    SELECT
        COUNT(*)::BIGINT AS total_rows,
        MIN(claim_month) AS earliest_month,
        MAX(claim_month) AS latest_month,
        COUNT(DISTINCT billing_npi)::INT AS unique_providers,
        COUNT(DISTINCT hcpcs_code)::INT AS unique_hcpcs_codes,
        ROUND(SUM(total_paid), 2)::DOUBLE AS total_spending,
        SUM(total_claims)::BIGINT AS total_claims
    FROM '{RAW}'
""")

# ---------------------------------------------------------------------------
# 9. monthly_trend.json — for landing page chart
# ---------------------------------------------------------------------------
print("\n[10/11] monthly_trend.json")
write_json("monthly_trend", f"""
    SELECT
        claim_month AS month,
        ROUND(SUM(total_paid), 2)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries
    FROM '{RAW}'
    GROUP BY claim_month
    ORDER BY claim_month
""")

# ---------------------------------------------------------------------------
# 10. top_providers.json — for landing page
# ---------------------------------------------------------------------------
print("\n[11/11] top_providers.json")
write_json("top_providers", f"""
    SELECT
        billing_npi,
        ROUND(SUM(total_paid), 2)::DOUBLE AS total_paid,
        SUM(total_claims)::BIGINT AS total_claims,
        SUM(unique_beneficiaries)::BIGINT AS unique_beneficiaries
    FROM '{RAW}'
    GROUP BY billing_npi
    ORDER BY SUM(total_paid) DESC
    LIMIT 20
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
