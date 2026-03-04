import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// Cron job that pings Railway /health every 5 minutes.
// Keeps Vercel functions warm and verifies Railway is responsive.
// Schedule configured in vercel.json.
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (not a random caller)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const railwayUrl = process.env.RAILWAY_QUERY_URL;
  if (!railwayUrl) {
    return NextResponse.json({ error: "RAILWAY_QUERY_URL not set" }, { status: 500 });
  }

  try {
    const start = Date.now();
    const response = await fetch(`${railwayUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as { ok: boolean; dataReady: boolean };
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      railway: {
        ok: data.ok,
        dataReady: data.dataReady,
        latencyMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Railway health check failed",
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 502 }
    );
  }
}
