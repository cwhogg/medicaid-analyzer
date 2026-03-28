import { NextRequest, NextResponse } from "next/server";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

function railwayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (RAILWAY_API_KEY) {
    headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
  }
  return headers;
}

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.ADMIN_API_KEY;

  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  const days = request.nextUrl.searchParams.get("days") || "30";

  try {
    const res = await fetch(`${RAILWAY_QUERY_URL}/traffic-sources?days=${days}`, {
      headers: railwayHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (err as { error?: string }).error || "Fetch failed" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch traffic sources";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
