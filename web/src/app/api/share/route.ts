import { NextRequest, NextResponse } from "next/server";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

export async function POST(request: NextRequest) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();

    if (!body.id || typeof body.id !== "string" || body.id.length > 20) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (!body.data || typeof body.data !== "object") {
      return NextResponse.json({ error: "data is required" }, { status: 400 });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (RAILWAY_API_KEY) {
      headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
    }

    const response = await fetch(`${RAILWAY_QUERY_URL}/share`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to save share" }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to save share" }, { status: 500 });
  }
}
