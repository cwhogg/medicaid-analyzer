const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const TIMEOUT_MS = 30_000;

export async function executeRemoteQuery(
  sql: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  if (!RAILWAY_QUERY_URL) {
    throw new Error("RAILWAY_QUERY_URL is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (RAILWAY_API_KEY) {
      headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
    }

    const response = await fetch(`${RAILWAY_QUERY_URL}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ sql }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = (errorData as { error?: string }).error || `Query service error: ${response.status}`;
      throw new Error(errorMsg);
    }

    const data = await response.json() as { columns: string[]; rows: unknown[][] };
    return { columns: data.columns, rows: data.rows };
  } finally {
    clearTimeout(timeout);
  }
}
