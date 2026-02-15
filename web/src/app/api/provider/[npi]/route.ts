import { NextRequest, NextResponse } from "next/server";
import { executeRemoteQuery } from "@/lib/railway";

export const maxDuration = 30;

const NPI_REGEX = /^\d{10}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ npi: string }> }
) {
  try {
    const { npi } = await params;

    if (!NPI_REGEX.test(npi)) {
      return NextResponse.json(
        { error: "Invalid NPI. Must be exactly 10 digits." },
        { status: 400 }
      );
    }

    // Run all 4 queries in parallel
    const [providerInfo, stats, procedures, trend] = await Promise.all([
      // 1. Provider info from npi_lookup
      executeRemoteQuery(`
        SELECT provider_name, provider_type, city, state
        FROM npi_lookup
        WHERE billing_npi = '${npi}'
        LIMIT 1
      `),

      // 2. Summary stats from pre-aggregated provider_stats
      executeRemoteQuery(`
        SELECT
          total_paid, total_claims, unique_beneficiaries,
          procedures_billed, first_month, last_month
        FROM provider_stats
        WHERE billing_npi = '${npi}'
      `),

      // 3. Top procedures from pre-aggregated provider_hcpcs
      executeRemoteQuery(`
        SELECT
          ph.hcpcs_code,
          COALESCE(h.description, 'Unknown') AS description,
          ph.total_paid AS total_spending,
          ph.total_claims AS total_claims,
          ph.unique_beneficiaries AS total_beneficiaries
        FROM provider_hcpcs ph
        LEFT JOIN hcpcs_lookup h ON ph.hcpcs_code = h.hcpcs_code
        WHERE ph.billing_npi = '${npi}'
        ORDER BY ph.total_paid DESC
        LIMIT 50
      `),

      // 4. Monthly spending trend from pre-aggregated provider_monthly
      executeRemoteQuery(`
        SELECT
          claim_month AS month,
          total_paid AS spending,
          total_claims AS claims
        FROM provider_monthly
        WHERE billing_npi = '${npi}' AND claim_month < '2024-10-01'
        ORDER BY claim_month
        LIMIT 100
      `),
    ]);

    // Check if provider exists
    if (providerInfo.rows.length === 0 && stats.rows.length === 0) {
      return NextResponse.json(
        { error: "Provider not found." },
        { status: 404 }
      );
    }

    // Build provider info object
    const info = providerInfo.rows.length > 0
      ? {
          name: providerInfo.rows[0][0] as string | null,
          type: providerInfo.rows[0][1] as string | null,
          city: providerInfo.rows[0][2] as string | null,
          state: providerInfo.rows[0][3] as string | null,
        }
      : { name: null, type: null, city: null, state: null };

    // Build summary stats
    const statsRow = stats.rows[0] || [];
    const summary = {
      total_paid: statsRow[0] as number | null,
      total_claims: statsRow[1] as number | null,
      unique_beneficiaries: statsRow[2] as number | null,
      procedures_billed: statsRow[3] as number | null,
      first_month: statsRow[4] as string | null,
      last_month: statsRow[5] as string | null,
    };

    return NextResponse.json({
      npi,
      info,
      summary,
      procedures: { columns: procedures.columns, rows: procedures.rows },
      trend: { columns: trend.columns, rows: trend.rows },
    });
  } catch (err) {
    console.error("Provider API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
