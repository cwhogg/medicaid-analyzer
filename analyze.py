"""Exploratory analysis of Medicaid provider spending data via DuckDB."""

import duckdb

PARQUET = "medicaid-provider-spending.parquet"
con = duckdb.connect()


def query(sql: str):
    """Run a SQL query against the Parquet file and print results as a table."""
    result = con.sql(sql)
    result.show()
    return result


def section(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


# ---------------------------------------------------------------------------
# 1. Basic stats
# ---------------------------------------------------------------------------
section("Row count and date range")
query(f"""
    SELECT
        count(*)::INT AS total_rows,
        min(claim_month) AS earliest_month,
        max(claim_month) AS latest_month,
        count(DISTINCT billing_npi) AS unique_billing_npis,
        count(DISTINCT servicing_npi) AS unique_servicing_npis,
        count(DISTINCT hcpcs_code) AS unique_hcpcs_codes
    FROM '{PARQUET}'
""")

# ---------------------------------------------------------------------------
# 2. Top 20 providers by total spending
# ---------------------------------------------------------------------------
section("Top 20 billing providers by total spending")
query(f"""
    SELECT
        billing_npi,
        round(sum(total_paid) / 1e9, 2) AS total_paid_billions,
        sum(total_claims) AS total_claims,
        sum(unique_beneficiaries) AS total_beneficiaries
    FROM '{PARQUET}'
    GROUP BY billing_npi
    ORDER BY sum(total_paid) DESC
    LIMIT 20
""")

# ---------------------------------------------------------------------------
# 3. Top 20 HCPCS codes by total spending
# ---------------------------------------------------------------------------
section("Top 20 HCPCS codes by total spending")
query(f"""
    SELECT
        hcpcs_code,
        round(sum(total_paid) / 1e9, 2) AS total_paid_billions,
        sum(total_claims) AS total_claims,
        count(DISTINCT billing_npi) AS num_providers
    FROM '{PARQUET}'
    GROUP BY hcpcs_code
    ORDER BY sum(total_paid) DESC
    LIMIT 20
""")

# ---------------------------------------------------------------------------
# 4. Monthly spending trends
# ---------------------------------------------------------------------------
section("Monthly spending trends")
query(f"""
    SELECT
        claim_month,
        round(sum(total_paid) / 1e9, 2) AS total_paid_billions,
        sum(total_claims) AS total_claims,
        sum(unique_beneficiaries) AS total_beneficiaries
    FROM '{PARQUET}'
    GROUP BY claim_month
    ORDER BY claim_month
""")

# ---------------------------------------------------------------------------
# 5. Distribution stats
# ---------------------------------------------------------------------------
section("Spending per claim distribution")
query(f"""
    WITH provider_stats AS (
        SELECT
            billing_npi,
            sum(total_paid) AS total_paid,
            sum(total_claims) AS total_claims,
            sum(total_paid) / nullif(sum(total_claims), 0) AS paid_per_claim
        FROM '{PARQUET}'
        GROUP BY billing_npi
    )
    SELECT
        count(*) AS num_providers,
        round(avg(paid_per_claim), 2) AS avg_paid_per_claim,
        round(median(paid_per_claim), 2) AS median_paid_per_claim,
        round(percentile_cont(0.90) WITHIN GROUP (ORDER BY paid_per_claim), 2) AS p90_paid_per_claim,
        round(percentile_cont(0.99) WITHIN GROUP (ORDER BY paid_per_claim), 2) AS p99_paid_per_claim,
        round(min(paid_per_claim), 2) AS min_paid_per_claim,
        round(max(paid_per_claim), 2) AS max_paid_per_claim
    FROM provider_stats
""")

section("Claims per provider distribution")
query(f"""
    WITH provider_stats AS (
        SELECT billing_npi, sum(total_claims) AS total_claims
        FROM '{PARQUET}'
        GROUP BY billing_npi
    )
    SELECT
        count(*) AS num_providers,
        round(avg(total_claims), 0) AS avg_claims,
        round(median(total_claims), 0) AS median_claims,
        round(percentile_cont(0.90) WITHIN GROUP (ORDER BY total_claims), 0) AS p90_claims,
        round(percentile_cont(0.99) WITHIN GROUP (ORDER BY total_claims), 0) AS p99_claims,
        min(total_claims) AS min_claims,
        max(total_claims) AS max_claims
    FROM provider_stats
""")

# ---------------------------------------------------------------------------
# 6. Providers with highest beneficiary counts
# ---------------------------------------------------------------------------
section("Top 20 providers by unique beneficiaries")
query(f"""
    SELECT
        billing_npi,
        sum(unique_beneficiaries) AS total_beneficiaries,
        round(sum(total_paid) / 1e9, 2) AS total_paid_billions,
        sum(total_claims) AS total_claims
    FROM '{PARQUET}'
    GROUP BY billing_npi
    ORDER BY sum(unique_beneficiaries) DESC
    LIMIT 20
""")

print("\n✓ All exploratory queries complete.")
