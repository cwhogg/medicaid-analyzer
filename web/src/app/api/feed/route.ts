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

// Client POSTs analysis results after completion
export async function POST(request: NextRequest) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Basic validation
    if (!body.id || !body.question || !body.route) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await fetch(`${RAILWAY_QUERY_URL}/feed/record`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to record" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to record" }, { status: 500 });
  }
}
