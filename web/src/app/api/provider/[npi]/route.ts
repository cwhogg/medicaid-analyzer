import { NextRequest, NextResponse } from "next/server";
import { executeRemoteQuery } from "@/lib/railway";
import { checkRateLimit } from "@/lib/rateLimit";
import { recordRequest } from "@/lib/metrics";

export const maxDuration = 30;

const NPI_REGEX = /^\d{10}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ npi: string }> }
) {
  const requestStart = Date.now();
  try {
    const ip = _request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || _request.headers.get("x-real-ip")
      || "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      recordRequest({ timestamp: Date.now(), route: "/api/provider", ip, status: 429, totalMs: Date.now() - requestStart, cached: false });
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfterSec} seconds.` },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSec) } }
      );
    }

    const { npi } = await params;

    if (!NPI_REGEX.test(npi)) {
      return NextResponse.json(
        { error: "Invalid NPI. Must be exactly 10 digits." },
        { status: 400 }
      );
    }

    // Parse optional year filter: ?years=2023,2024
    const yearsParam = _request.nextUrl.searchParams.get("years");
    let yearFilter = "";
    let monthYearFilter = "";
    if (yearsParam) {
      const years = yearsParam.split(",").map((s) => parseInt(s, 10));
      if (years.length > 7 || years.some((y) => isNaN(y) || y < 2018 || y > 2024)) {
        return NextResponse.json(
          { error: "Invalid years parameter. Each year must be 2018-2024, max 7 values." },
          { status: 400 }
        );
      }
      yearFilter = ` AND year IN (${years.join(",")})`;
      monthYearFilter = ` AND YEAR(claim_month) IN (${years.join(",")})`;
    }

    // Run all 5 queries in parallel
    const railwayStart = Date.now();
    const [providerInfo, stats, procedureCount, procedures, trend] = await Promise.all([
      // 1. Provider info from npi_lookup
      executeRemoteQuery(`
        SELECT provider_name, provider_type, city, state
        FROM npi_lookup
        WHERE billing_npi = '${npi}'
        LIMIT 1
      `),

      // 2. Summary stats from pre-aggregated provider_stats (aggregate across year rows)
      executeRemoteQuery(`
        SELECT
          SUM(total_paid) AS total_paid,
          SUM(total_claims) AS total_claims,
          SUM(unique_beneficiaries) AS unique_beneficiaries,
          MIN(first_month) AS first_month,
          MAX(last_month) AS last_month
        FROM provider_stats
        WHERE billing_npi = '${npi}'${yearFilter}
      `),

      // 2b. Procedures billed (distinct count from provider_hcpcs)
      executeRemoteQuery(`
        SELECT COUNT(DISTINCT hcpcs_code) AS procedures_billed
        FROM provider_hcpcs
        WHERE billing_npi = '${npi}'${yearFilter}
      `),

      // 3. Top procedures from pre-aggregated provider_hcpcs (aggregate across years)
      executeRemoteQuery(`
        SELECT
          ph.hcpcs_code,
          COALESCE(h.description, 'Unknown') AS description,
          SUM(ph.total_paid) AS total_spending,
          SUM(ph.total_claims) AS total_claims,
          SUM(ph.unique_beneficiaries) AS total_beneficiaries
        FROM provider_hcpcs ph
        LEFT JOIN hcpcs_lookup h ON ph.hcpcs_code = h.hcpcs_code
        WHERE ph.billing_npi = '${npi}'${yearFilter}
        GROUP BY ph.hcpcs_code, h.description
        ORDER BY total_spending DESC
        LIMIT 50
      `),

      // 4. Monthly spending trend from pre-aggregated provider_monthly
      executeRemoteQuery(`
        SELECT
          claim_month AS month,
          total_paid AS spending,
          total_claims AS claims
        FROM provider_monthly
        WHERE billing_npi = '${npi}' AND claim_month < '2024-10-01'${monthYearFilter}
        ORDER BY claim_month
        LIMIT 100
      `),
    ]);

    const railwayMs = Date.now() - railwayStart;

    // Check if provider exists
    if (providerInfo.rows.length === 0 && stats.rows.length === 0) {
      recordRequest({ timestamp: Date.now(), route: "/api/provider", ip, status: 404, railwayMs, totalMs: Date.now() - requestStart, cached: false });
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
    const procCountRow = procedureCount.rows[0] || [];
    const summary = {
      total_paid: statsRow[0] as number | null,
      total_claims: statsRow[1] as number | null,
      unique_beneficiaries: statsRow[2] as number | null,
      procedures_billed: (procCountRow[0] as number | null),
      first_month: statsRow[3] as string | null,
      last_month: statsRow[4] as string | null,
    };

    recordRequest({ timestamp: Date.now(), route: "/api/provider", ip, status: 200, railwayMs, totalMs: Date.now() - requestStart, cached: false });

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
