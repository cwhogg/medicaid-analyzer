"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";

interface ResultsChartProps {
  columns: string[];
  rows: unknown[][];
  chartType: "line" | "bar" | "pie";
}

const COLORS = [
  "#EA580C",
  "#F97316",
  "#FB923C",
  "#FDBA74",
  "#FED7AA",
  "#9333EA",
  "#A855F7",
  "#C084FC",
  "#3B82F6",
  "#60A5FA",
];

function isDollarColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /paid|spending|cost|amount|payment|charge|price/.test(lower);
}

function formatValue(value: unknown, colName?: string): string {
  if (typeof value === "number") {
    const dollar = colName ? isDollarColumn(colName) : false;
    const prefix = dollar ? "$" : "";
    if (Math.abs(value) >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`;
    return dollar
      ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

function shortenLabel(label: string, max: number = 20): string {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + "\u2026";
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="glass-card p-3 text-sm">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatValue(entry.value, entry.dataKey || entry.name)}
        </p>
      ))}
    </div>
  );
}

export function ResultsChart({ columns, rows, chartType }: ResultsChartProps) {
  const { data, labelKey, valueKeys } = useMemo(() => {
    if (!columns.length || !rows.length) return { data: [], labelKey: "", valueKeys: [] };

    // Find a human-readable label column (description or provider_name)
    const descIdx = columns.findIndex(
      (c) => c.toLowerCase() === "description" || c.toLowerCase() === "provider_name"
    );
    const firstCol = columns[0];

    // Use a synthetic "_label" field that combines code + description
    const LABEL_KEY = "_label";

    // Columns that are identifiers/labels, not metrics — never chart these as values
    const EXCLUDED_COLS = /^(hcpcs_code|billing_npi|provider_name|description|city|state|provider_type|claim_month|first_month|last_month)$/i;

    const valueKeys = columns.filter((col, i) => {
      if (EXCLUDED_COLS.test(col)) return false;
      const sample = rows[0]?.[i];
      // Exclude year-like values (4-digit numbers that look like years)
      if ((typeof sample === "number" || typeof sample === "bigint") && Number(sample) >= 1900 && Number(sample) <= 2100) {
        return false;
      }
      return typeof sample === "number" || typeof sample === "bigint";
    });

    const data = rows.map((row) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        let val = row[i];
        if (typeof val === "bigint") val = Number(val);
        record[col] = val;
      });

      // Build a human-readable label
      if (descIdx !== -1 && row[descIdx] && String(row[descIdx]).trim()) {
        record[LABEL_KEY] = shortenLabel(String(row[descIdx]), 28);
      } else if (typeof record[firstCol] === "string") {
        record[LABEL_KEY] = shortenLabel(record[firstCol] as string);
      } else {
        record[LABEL_KEY] = String(record[firstCol] ?? "");
      }

      return record;
    });

    const labelKey = LABEL_KEY;
    return { data, labelKey, valueKeys };
  }, [columns, rows]);

  if (!data.length || !valueKeys.length) return null;

  return (
    <GlassCard className="p-6">
      <ResponsiveContainer width="100%" height={400}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data.slice(0, 10)}
              dataKey={valueKeys[0]}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={150}
              label={({ name, percent }) =>
                `${shortenLabel(String(name), 15)} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.slice(0, 10).map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        ) : chartType === "bar" ? (
          <BarChart data={data.slice(0, 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey={labelKey}
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatValue(v, valueKeys[0])}
            />
            <Tooltip content={<CustomTooltip />} />
            {valueKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey={labelKey}
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatValue(v, valueKeys[0])}
            />
            <Tooltip content={<CustomTooltip />} />
            {valueKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </GlassCard>
  );
}
