import { NextRequest, NextResponse } from "next/server";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!RAILWAY_QUERY_URL) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { id } = await params;

  if (!id || typeof id !== "string" || id.length > 20) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const response = await fetch(`${RAILWAY_QUERY_URL}/share/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Share not found or expired" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to fetch share" }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch share" }, { status: 500 });
  }
}
