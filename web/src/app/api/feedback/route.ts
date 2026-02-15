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

export async function POST(request: NextRequest) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();

    if (!body.message || typeof body.message !== "string" || body.message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    const response = await fetch(`${RAILWAY_QUERY_URL}/feedback`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({
        id: crypto.randomUUID(),
        message: body.message.trim(),
        page: body.page || null,
        ip,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
