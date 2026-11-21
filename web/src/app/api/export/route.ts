// Read-only export for the external admin app (github.com/cwhogg/admin).
// Auth: `Authorization: Bearer <ADMIN_EXPORT_TOKEN>` — closed when unset.
// IPs are dropped entirely (Railway already masks them; we don't pass even
// the masked form along).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getMetrics, getDailyQueries, getFeedback } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const MAX_DAYS = 30;

function authorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_EXPORT_TOKEN;
  if (!expected) return false;
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const a = Buffer.from(auth.slice("Bearer ".length));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function getTrafficSources(days: number) {
  if (!RAILWAY_QUERY_URL) return null;
  const res = await fetch(`${RAILWAY_QUERY_URL}/traffic-sources?days=${days}`, {
    headers: RAILWAY_API_KEY ? { Authorization: `Bearer ${RAILWAY_API_KEY}` } : {},
    signal: AbortSignal.timeout(10000),
  });
  return res.ok ? res.json() : null;
}

function dayKeys(days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

type Row = Record<string, unknown>;

function stripQuery(q: Row) {
  return {
    timestamp: q.timestamp,
    route: q.route,
    question: q.question,
    sql: q.sql,
    status: q.status,
    totalMs: q.totalMs,
    cached: q.cached,
    error: q.error ?? null,
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = Math.min(MAX_DAYS, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 7));

  try {
    const [metrics, daily, feedback, traffic, ...perDay] = await Promise.all([
      getMetrics(),
      getDailyQueries().then((r) => (r as { days?: Row[] }).days ?? []),
      getFeedback().catch(() => []),
      getTrafficSources(days).catch(() => null),
      ...dayKeys(days).map((d) => getDailyQueries(d).then((r) => (r as { queries?: Row[] }).queries ?? []).catch(() => [])),
    ]);

    // recentQueries is dropped: `queries` below covers the whole window.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { traffic: t, recentQueries, ...rest } = metrics;
    const since = Date.now() - days * 86400000;

    return NextResponse.json({
      app: "ohdh",
      generatedAt: new Date().toISOString(),
      window: { days, since: new Date(since).toISOString() },
      metrics: {
        ...rest,
        traffic: {
          totalRequests: t.totalRequests,
          uniqueUsers: t.uniqueUsers,
          byRoute: t.byRoute,
          byStatus: t.byStatus,
          topUserCities: (t.topUsers as Row[]).map((u) => ({ city: u.city, count: u.count })),
        },
      },
      daily,
      queries: (perDay as Row[][]).flat().map(stripQuery),
      feedback: (feedback as Row[])
        .filter((f) => Number(f.timestamp) >= since)
        .map((f) => ({ id: f.id, message: f.message, page: f.page, timestamp: f.timestamp })),
      traffic,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
