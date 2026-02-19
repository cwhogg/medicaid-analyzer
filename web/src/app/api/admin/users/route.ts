import { NextRequest, NextResponse } from "next/server";
import { getDetailedUsers } from "@/lib/metrics";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  const secret = process.env.ADMIN_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await getDetailedUsers();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch users";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
