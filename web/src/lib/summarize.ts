const MAX_SUMMARY_ROWS = 20;

export function summarizeResults(columns: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(`Columns: ${columns.join(", ")}`);
  lines.push(`Row count: ${rows.length}`);

  // Show first N rows
  const preview = rows.slice(0, MAX_SUMMARY_ROWS);
  for (const row of preview) {
    const cells = row.map((cell, i) => `${columns[i]}=${cell}`);
    lines.push(cells.join(", "));
  }

  if (rows.length > MAX_SUMMARY_ROWS) {
    lines.push(`... and ${rows.length - MAX_SUMMARY_ROWS} more rows`);
  }

  // Numeric column stats
  for (let i = 0; i < columns.length; i++) {
    const numericVals = rows
      .map((r) => r[i])
      .filter((v): v is number => typeof v === "number");
    if (numericVals.length > 0) {
      const min = Math.min(...numericVals);
      const max = Math.max(...numericVals);
      const sum = numericVals.reduce((a, b) => a + b, 0);
      const avg = sum / numericVals.length;
      lines.push(`${columns[i]} stats: min=${min}, max=${max}, avg=${Math.round(avg)}, sum=${Math.round(sum)}`);
    }
  }

  return lines.join("\n");
}
