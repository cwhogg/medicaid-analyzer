import { NextRequest, NextResponse } from "next/server";
import { getMetrics, getFeedback } from "@/lib/metrics";
import { getRateLimitStats } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.ADMIN_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const [metrics, feedback] = await Promise.all([
      getMetrics(),
      getFeedback().catch(() => []),
    ]);
    const rateLimit = getRateLimitStats();
    return NextResponse.json({ ...metrics, rateLimit, feedback });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch metrics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
