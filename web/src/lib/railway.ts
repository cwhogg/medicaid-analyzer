const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const BRFSS_QUERY_URL = process.env.BRFSS_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;
const TIMEOUT_MS = 90_000;

export async function executeRemoteQuery(
  sql: string,
  dataset: "medicaid" | "brfss" = "medicaid"
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const baseUrl = dataset === "brfss" ? BRFSS_QUERY_URL : RAILWAY_QUERY_URL;
  if (!baseUrl) {
    throw new Error(dataset === "brfss" ? "BRFSS_QUERY_URL is not configured" : "RAILWAY_QUERY_URL is not configured");
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

    const response = await fetch(`${baseUrl}/query`, {
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
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Query timed out — the dataset is large and this query may need simplification.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
