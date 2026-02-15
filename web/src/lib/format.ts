export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (Math.abs(value) >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatFullNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T|\s)/;

/**
 * Format a date/timestamp cell value based on column context.
 * - "year" columns → "2019"
 * - "month"/"date"/"quarter"/"period" columns → "Jan 2019"
 * Returns null if the value isn't a recognizable date string.
 */
export function formatDateCell(value: unknown, colName?: string): string | null {
  if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  const lower = (colName || "").toLowerCase();
  if (lower === "year" || lower.endsWith("_year")) {
    return String(d.getUTCFullYear());
  }
  // Month, date, quarter, period, or any other temporal column
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${d.getUTCFullYear()}`;
}
