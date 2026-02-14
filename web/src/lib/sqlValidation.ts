// --- SQL Validation ---
const FORBIDDEN_KEYWORDS = [
  "CREATE", "DROP", "ALTER", "TRUNCATE",
  "INSERT", "UPDATE", "DELETE", "MERGE",
  "GRANT", "REVOKE", "EXEC", "EXECUTE",
  "CALL", "COPY", "ATTACH", "DETACH",
  "LOAD", "INSTALL", "PRAGMA",
];

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().replace(/;+$/, "").trim();
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(upper)) {
      return { valid: false, error: `Forbidden SQL keyword detected: ${keyword}` };
    }
  }

  return { valid: true };
}

export function inferChartType(sql: string, question: string): "table" | "line" | "bar" | "pie" {
  const q = question.toLowerCase();
  const s = sql.toLowerCase();

  if (q.includes("trend") || q.includes("over time") || q.includes("monthly") || q.includes("by month") || q.includes("by year")) {
    return "line";
  }
  if (q.includes("top") || q.includes("compare") || q.includes("ranking") || q.includes("highest") || q.includes("largest")) {
    return "bar";
  }
  if (q.includes("breakdown") || q.includes("distribution") || q.includes("share") || q.includes("proportion") || q.includes("percentage")) {
    return "pie";
  }
  if (s.includes("claim_month") || s.includes("date_trunc") || s.includes("extract(year")) {
    return "line";
  }
  if (s.includes("order by") && s.includes("limit")) {
    return "bar";
  }

  return "table";
}
