import { getDataset } from "@/lib/datasets/index";

const TIMEOUT_MS = 90_000;

export async function executeRemoteQuery(
  sql: string,
  dataset: string = "medicaid"
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const config = getDataset(dataset);
  const baseUrl = process.env[config.envUrlKey];
  const apiKey = process.env[config.envApiKeyKey];

  if (!baseUrl) {
    throw new Error(`${config.envUrlKey} is not configured`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
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
