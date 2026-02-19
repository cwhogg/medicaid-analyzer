// Persistent metrics — stored in Railway's DuckDB on persistent volume
// Records are fire-and-forget POSTed to Railway, reads fetch from Railway

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

export interface RequestRecord {
  timestamp: number;
  route: string;
  ip: string;
  status: number;
  claudeMs?: number;
  railwayMs?: number;
  totalMs: number;
  cached: boolean;
  inputTokens?: number;
  outputTokens?: number;
}

export interface QueryLogEntry {
  timestamp: number;
  ip: string;
  route: string;
  question: string;
  sql: string | null;
  status: number;
  totalMs: number;
  cached: boolean;
  error?: string;
}

function railwayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (RAILWAY_API_KEY) {
    headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
  }
  return headers;
}

// Fire-and-forget POST to Railway — never throws, never blocks the response
function sendToRailway(request?: RequestRecord, query?: QueryLogEntry): void {
  if (!RAILWAY_QUERY_URL) return;

  const body: Record<string, unknown> = {};
  if (request) {
    body.request = {
      timestamp: request.timestamp,
      route: request.route,
      ip: request.ip,
      status: request.status,
      claudeMs: request.claudeMs,
      railwayMs: request.railwayMs,
      totalMs: request.totalMs,
      cached: request.cached,
      inputTokens: request.inputTokens,
      outputTokens: request.outputTokens,
    };
  }
  if (query) {
    body.query = {
      timestamp: query.timestamp,
      ip: query.ip,
      route: query.route,
      question: query.question,
      sql: query.sql,
      status: query.status,
      totalMs: query.totalMs,
      cached: query.cached,
      error: query.error,
    };
  }

  fetch(`${RAILWAY_QUERY_URL}/metrics/record`, {
    method: "POST",
    headers: railwayHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silently ignore — metrics should never break the main request
  });
}

export function recordRequest(record: RequestRecord) {
  sendToRailway(record, undefined);
}

export function recordQuery(entry: QueryLogEntry) {
  sendToRailway(undefined, entry);
}

export function recordFeedItem(item: {
  id: string;
  question: string;
  route: string;
  timestamp: number;
  summary?: string | null;
  stepCount?: number;
  rowCount?: number;
  resultData?: unknown;
}): void {
  if (!RAILWAY_QUERY_URL) return;

  fetch(`${RAILWAY_QUERY_URL}/feed/record`, {
    method: "POST",
    headers: railwayHeaders(),
    body: JSON.stringify(item),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

export async function getFeedback(): Promise<Record<string, unknown>[]> {
  if (!RAILWAY_QUERY_URL) return [];

  const response = await fetch(`${RAILWAY_QUERY_URL}/feedback?limit=50`, {
    headers: railwayHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

export async function getDetailedUsers() {
  if (!RAILWAY_QUERY_URL) {
    throw new Error("RAILWAY_QUERY_URL is not configured");
  }

  const response = await fetch(`${RAILWAY_QUERY_URL}/metrics/users`, {
    headers: railwayHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || `Users fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function getDailyQueries(day?: string) {
  if (!RAILWAY_QUERY_URL) {
    throw new Error("RAILWAY_QUERY_URL is not configured");
  }

  const url = day
    ? `${RAILWAY_QUERY_URL}/metrics/daily-queries?day=${encodeURIComponent(day)}`
    : `${RAILWAY_QUERY_URL}/metrics/daily-queries`;

  const response = await fetch(url, {
    headers: railwayHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || `Daily queries fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function getRetention() {
  if (!RAILWAY_QUERY_URL) {
    throw new Error("RAILWAY_QUERY_URL is not configured");
  }

  const response = await fetch(`${RAILWAY_QUERY_URL}/metrics/retention`, {
    headers: railwayHeaders(),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || `Retention fetch failed: ${response.status}`);
  }

  return response.json();
}

export async function getMetrics() {
  if (!RAILWAY_QUERY_URL) {
    throw new Error("RAILWAY_QUERY_URL is not configured");
  }

  const response = await fetch(`${RAILWAY_QUERY_URL}/metrics`, {
    headers: railwayHeaders(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error((errorData as { error?: string }).error || `Metrics fetch failed: ${response.status}`);
  }

  return response.json();
}
