const MAX_PREVIEW_ROWS = 15;

export function summarizeResults(columns: string[], rows: unknown[][]): string {
  const sections: string[] = [];

  // === SHAPE ===
  sections.push(`SHAPE: ${rows.length} rows x ${columns.length} columns (${columns.join(", ")})`);

  // === STATISTICS ===
  const statLines: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const values = rows.map((r) => r[i]);
    const numericVals = values.filter((v): v is number => typeof v === "number" && !isNaN(v));

    if (numericVals.length > 0) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      const n = sorted.length;
      const min = sorted[0];
      const max = sorted[n - 1];
      const sum = numericVals.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

      // Standard deviation
      const variance = numericVals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
      const stdDev = Math.sqrt(variance);

      // Skewness indicator (mean vs median ratio)
      const skew = median !== 0 ? mean / median : 0;
      let skewLabel = "symmetric";
      if (skew > 1.5) skewLabel = "RIGHT-SKEWED (long tail of high values)";
      else if (skew > 1.15) skewLabel = "moderately right-skewed";
      else if (skew < 0.67) skewLabel = "LEFT-SKEWED";
      else if (skew < 0.87) skewLabel = "moderately left-skewed";

      // Outlier count (beyond 2 std devs)
      const outlierThresholdLow = mean - 2 * stdDev;
      const outlierThresholdHigh = mean + 2 * stdDev;
      const outliers = numericVals.filter((v) => v < outlierThresholdLow || v > outlierThresholdHigh).length;

      const isDollar = /paid|spending|cost|amount|total_paid/i.test(col);
      const isBeneficiary = /beneficiar/i.test(col);
      const fmt = (v: number) => isDollar ? `$${Math.round(v).toLocaleString("en-US")}` : round(v);

      // Beneficiary counts must NOT be summed across rows (overlap between codes/providers)
      let line: string;
      if (isBeneficiary) {
        line = `  ${col}: min=${fmt(min)}, max=${fmt(max)}, mean=${fmt(mean)}, median=${fmt(median)}, stdDev=${fmt(stdDev)}, distribution=${skewLabel} (DO NOT SUM — beneficiaries overlap across codes/providers)`;
      } else {
        line = `  ${col}: min=${fmt(min)}, max=${fmt(max)}, mean=${fmt(mean)}, median=${fmt(median)}, sum=${fmt(sum)}, stdDev=${fmt(stdDev)}, distribution=${skewLabel}`;
      }
      if (outliers > 0) line += `, outliers=${outliers}/${n}`;
      statLines.push(line);
    } else {
      // Categorical column — show unique count
      const uniqueVals = new Set(values.map(String));
      statLines.push(`  ${col}: ${uniqueVals.size} unique values (categorical)`);
    }
  }
  if (statLines.length > 0) {
    sections.push(`STATISTICS:\n${statLines.join("\n")}`);
  }

  // === KEY FINDINGS ===
  const findings: string[] = [];

  // Concentration / Pareto analysis for numeric columns
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (!/paid|spending|cost|amount|claims/i.test(col)) continue;
    if (/beneficiar/i.test(col)) continue; // beneficiaries overlap — sum is meaningless

    const numericVals = rows.map((r) => r[i]).filter((v): v is number => typeof v === "number" && !isNaN(v));
    if (numericVals.length < 5) continue;

    const sorted = [...numericVals].sort((a, b) => b - a);
    const total = sorted.reduce((a, b) => a + b, 0);
    if (total === 0) continue;

    const top20pctCount = Math.max(1, Math.ceil(sorted.length * 0.2));
    const top20pctSum = sorted.slice(0, top20pctCount).reduce((a, b) => a + b, 0);
    const top20pctShare = (top20pctSum / total) * 100;

    if (top20pctShare > 60) {
      findings.push(`Concentration: Top 20% of entries account for ${Math.round(top20pctShare)}% of ${col}`);
    }
  }

  // Trend detection for time-series data
  const timeColIdx = columns.findIndex((c) => /month|date|year|period|quarter/i.test(c));
  if (timeColIdx >= 0 && rows.length >= 6) {
    for (let i = 0; i < columns.length; i++) {
      if (i === timeColIdx) continue;
      const numericVals = rows.map((r) => r[i]).filter((v): v is number => typeof v === "number" && !isNaN(v));
      if (numericVals.length < 6) continue;

      const thirdLen = Math.floor(numericVals.length / 3);
      const firstThird = numericVals.slice(0, thirdLen);
      const lastThird = numericVals.slice(-thirdLen);
      const avgFirst = firstThird.reduce((a, b) => a + b, 0) / firstThird.length;
      const avgLast = lastThird.reduce((a, b) => a + b, 0) / lastThird.length;

      if (avgFirst === 0) continue;
      const pctChange = ((avgLast - avgFirst) / Math.abs(avgFirst)) * 100;

      if (Math.abs(pctChange) > 15) {
        const direction = pctChange > 0 ? "INCREASING" : "DECREASING";
        findings.push(`Trend: ${columns[i]} is ${direction} (${pctChange > 0 ? "+" : ""}${Math.round(pctChange)}% change from first third to last third of data)`);
      }
    }
  }

  if (findings.length > 0) {
    sections.push(`KEY FINDINGS:\n${findings.map((f) => `  - ${f}`).join("\n")}`);
  }

  // === DATA PREVIEW ===
  const preview = rows.slice(0, MAX_PREVIEW_ROWS);
  const previewLines = preview.map((row) => {
    const cells = row.map((cell, i) => {
      const col = columns[i];
      const isDollar = /paid|spending|cost|amount|total_paid/i.test(col);
      if (isDollar && typeof cell === "number") {
        return `${col}=$${Math.round(cell).toLocaleString("en-US")}`;
      }
      return `${col}=${cell}`;
    });
    return cells.join(" | ");
  });
  sections.push(`DATA PREVIEW (first ${preview.length} of ${rows.length} rows):\n${previewLines.join("\n")}`);
  if (rows.length > MAX_PREVIEW_ROWS) {
    sections.push(`... and ${rows.length - MAX_PREVIEW_ROWS} more rows`);
  }

  return sections.join("\n\n");
}

function round(v: number): string {
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-US");
  if (Math.abs(v) >= 1) return v.toFixed(1);
  if (v === 0) return "0";
  return v.toPrecision(3);
}
