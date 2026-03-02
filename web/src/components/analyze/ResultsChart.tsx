"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
import { formatDateCell } from "@/lib/format";

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
    if (Math.abs(value) >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${prefix}${(value / 1e3).toFixed(0)}K`;
    return dollar
      ? `$${Math.round(value).toLocaleString()}`
      : Math.round(value).toLocaleString();
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  const check = useCallback(() => setIsMobile(window.innerWidth < 640), []);
  useEffect(() => {
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [check]);
  return isMobile;
}

export function ResultsChart({ columns, rows, chartType }: ResultsChartProps) {
  const isMobile = useIsMobile();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

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

    // Find all non-numeric (string) columns to use as label parts
    const stringColIndices = columns
      .map((col, i) => ({ col, i }))
      .filter(({ i }) => {
        const sample = rows[0]?.[i];
        return typeof sample === "string";
      });

    const data = rows.map((row) => {
      const record: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        let val = row[i];
        if (typeof val === "bigint") val = Number(val);
        record[col] = val;
      });

      // Build a human-readable label by combining all string columns
      // If multiple string cols exist (e.g. "factor" + "category"), join them
      if (stringColIndices.length >= 2) {
        const parts = stringColIndices
          .map(({ i }) => String(row[i] ?? "").trim())
          .filter(Boolean);
        record[LABEL_KEY] = shortenLabel(parts.join(": "), 36);
      } else if (descIdx !== -1 && row[descIdx] && String(row[descIdx]).trim()) {
        record[LABEL_KEY] = shortenLabel(String(row[descIdx]), 28);
      } else {
        // Try date formatting for the first column
        const dateLabel = formatDateCell(record[firstCol], firstCol);
        if (dateLabel) {
          record[LABEL_KEY] = dateLabel;
        } else if (typeof record[firstCol] === "string") {
          record[LABEL_KEY] = shortenLabel(record[firstCol] as string, 28);
        } else {
          record[LABEL_KEY] = String(record[firstCol] ?? "");
        }
      }

      return record;
    });

    const labelKey = LABEL_KEY;
    return { data, labelKey, valueKeys };
  }, [columns, rows]);

  // Reset visible keys when valueKeys change
  useEffect(() => {
    setVisibleKeys(new Set(valueKeys));
  }, [valueKeys.join(",")]);

  const activeKeys = useMemo(() => {
    const filtered = valueKeys.filter((k) => visibleKeys.has(k));
    return filtered;
  }, [valueKeys, visibleKeys]);

  const toggleKey = useCallback(
    (key: string) => {
      if (chartType === "pie") {
        // Radio behavior: exactly one selected
        setVisibleKeys(new Set([key]));
        return;
      }
      setVisibleKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    [chartType]
  );

  if (!data.length || !valueKeys.length) return null;

  const showToggles = valueKeys.length >= 2;

  return (
    <GlassCard className="p-3 sm:p-6">
      {showToggles && (
        <div className="flex flex-wrap gap-2 mb-4">
          {valueKeys.map((key, i) => {
            const active = visibleKeys.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleKey(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-white/[0.1] text-white"
                    : "bg-white/[0.03] text-gray-500"
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: active
                      ? COLORS[i % COLORS.length]
                      : "transparent",
                    border: active
                      ? "none"
                      : `1.5px solid ${COLORS[i % COLORS.length]}`,
                  }}
                />
                {key.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      )}
      {activeKeys.length === 0 ? (
        <div className="flex items-center justify-center" style={{ height: isMobile ? 280 : 400 }}>
          <p className="text-gray-500 text-sm">Select a column to chart</p>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
        {chartType === "pie" ? (
          <PieChart>
            <Pie
              data={data.slice(0, 10)}
              dataKey={activeKeys[0]}
              nameKey={labelKey}
              cx="50%"
              cy="50%"
              outerRadius={isMobile ? 90 : 150}
              label={isMobile ? false : ({ name, percent }) =>
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
          <BarChart data={data.slice(0, isMobile ? 10 : 20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey={labelKey}
              stroke="#6B7280"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={isMobile ? 60 : 80}
              interval={0}
              tickFormatter={(v) => shortenLabel(String(v), isMobile ? 10 : 20)}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 45 : undefined}
              tickFormatter={(v) => formatValue(v, valueKeys[0])}
            />
            <Tooltip content={<CustomTooltip />} />
            {activeKeys.map((key) => {
              const i = valueKeys.indexOf(key);
              return <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />;
            })}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey={labelKey}
              stroke="#6B7280"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
            />
            <YAxis
              stroke="#6B7280"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 45 : undefined}
              tickFormatter={(v) => formatValue(v, valueKeys[0])}
            />
            <Tooltip content={<CustomTooltip />} />
            {activeKeys.map((key) => {
              const i = valueKeys.indexOf(key);
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              );
            })}
          </LineChart>
        )}
      </ResponsiveContainer>
      )}
    </GlassCard>
  );
}
