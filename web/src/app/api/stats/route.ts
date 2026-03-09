import { NextResponse } from "next/server";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

export async function GET() {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ totalQueries: 0 });
  }

  try {
    const headers: Record<string, string> = {};
    if (RAILWAY_API_KEY) {
      headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
    }

    const res = await fetch(`${RAILWAY_QUERY_URL}/metrics`, {
      headers,
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ totalQueries: 0 });
    }

    const data = await res.json();
    return NextResponse.json(
      { totalQueries: data.traffic?.totalRequests || 0 },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ totalQueries: 0 });
  }
}
