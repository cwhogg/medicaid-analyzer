import { NextRequest, NextResponse } from "next/server";
import { getMetrics } from "@/lib/metrics";
import { getRateLimitStats } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.ADMIN_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const metrics = getMetrics();
  const rateLimit = getRateLimitStats();

  return NextResponse.json({ ...metrics, rateLimit });
}
