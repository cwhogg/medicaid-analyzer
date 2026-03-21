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

  const top = request.nextUrl.searchParams.get("top");
  const endpoint = top ? "/tweet-metrics/top" : "/tweet-metrics";

  try {
    const res = await fetch(`${RAILWAY_QUERY_URL}${endpoint}`, {
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
    const message = err instanceof Error ? err.message : "Failed to fetch tweet metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key") || request.headers.get("x-admin-key");
  const secret = process.env.ADMIN_API_KEY;

  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const res = await fetch(`${RAILWAY_QUERY_URL}/tweet-metrics`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: (err as { error?: string }).error || "Save failed" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save tweet metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
