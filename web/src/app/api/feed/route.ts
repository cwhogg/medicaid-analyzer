import { NextRequest, NextResponse } from "next/server";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;

export async function GET(request: NextRequest) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ items: [] });
  }

  const limit = request.nextUrl.searchParams.get("limit") || "50";

  try {
    const response = await fetch(`${RAILWAY_QUERY_URL}/feed?limit=${limit}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ items: [] });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ items: [] });
  }
}
