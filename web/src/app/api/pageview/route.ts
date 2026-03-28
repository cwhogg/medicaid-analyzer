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

// POST — record a page view (public, no auth needed)
export async function POST(request: NextRequest) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ ok: true }); // silently skip if not configured
  }

  try {
    const body = await request.json();

    // Extract IP from request headers
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const res = await fetch(`${RAILWAY_QUERY_URL}/pageview`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({ ...body, ip }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget — don't fail the page load
    return NextResponse.json({ ok: true });
  }
}
