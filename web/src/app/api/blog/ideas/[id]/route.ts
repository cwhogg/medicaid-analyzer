import { NextRequest } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_API_KEY;
const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

function railwayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (RAILWAY_API_KEY) {
    headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
  }
  return headers;
}

// PATCH — Update idea fields
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RAILWAY_QUERY_URL) {
    return Response.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  const { id } = await params;
  const updates = await request.json();

  // Fetch current idea
  const getRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
    headers: railwayHeaders(),
  });
  if (!getRes.ok) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }
  const { idea } = await getRes.json();
  const data = idea.data || {};

  // Merge updates into data
  if (updates.title) data.title = updates.title;
  if (updates.description) data.description = updates.description;
  if (updates.targetKeywords) data.targetKeywords = updates.targetKeywords;
  if (updates.contentGap) data.contentGap = updates.contentGap;
  if (updates.analysisQuestions) data.analysisQuestions = updates.analysisQuestions;

  // Determine status and sync it into data
  const status = updates.status || idea.status;
  if (updates.status) data.status = updates.status;

  // Append action with appropriate type
  const actions = Array.isArray(data.actions) ? data.actions : [];
  const actionType = status !== idea.status ? status : "edited";
  actions.push({ type: actionType, timestamp: Date.now() });
  data.actions = actions;
  data.updatedAt = Date.now();

  const patchRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
    method: "PATCH",
    headers: railwayHeaders(),
    body: JSON.stringify({ data, status }),
  });

  if (!patchRes.ok) {
    const err = await patchRes.text();
    return Response.json({ error: `Update failed: ${err}` }, { status: 500 });
  }

  return Response.json({ ok: true, idea: data });
}

// DELETE — Soft-delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RAILWAY_QUERY_URL) {
    return Response.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  const { id } = await params;

  const delRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
    method: "DELETE",
    headers: railwayHeaders(),
  });

  if (!delRes.ok) {
    const err = await delRes.text();
    return Response.json({ error: `Delete failed: ${err}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
