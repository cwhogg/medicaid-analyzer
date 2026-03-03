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
import { formatDateCell } from "@/lib/format";

interface ResultsChartProps {
  columns: string[];
  rows: unknown[][];
  chartType: "line" | "bar" | "pie";
}

const COLORS = [
  "#B91C1C",
  "#0F766E",
  "#1D4ED8",
  "#7C3AED",
  "#D97706",
  "#059669",
  "#DC2626",
  "#2563EB",
  "#9333EA",
  "#C2410C",
];

function isDollarColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /paid|spending|cost|amount|payment|charge|price/.test(lower);
}

function isDecimalColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /avg|mean|average|rate|pct|percent|prevalence|ratio|proportion|per_/.test(lower);
}

function formatValue(value: unknown, colName?: string): string {
  if (typeof value === "number") {
    const dollar = colName ? isDollarColumn(colName) : false;
    const decimal = colName ? isDecimalColumn(colName) : false;
    const prefix = dollar ? "$" : "";
    if (Math.abs(value) >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `${prefix}${(value / 1e3).toFixed(decimal ? 1 : 0)}K`;
    if (dollar) return `$${Math.round(value).toLocaleString()}`;
    if (decimal || !Number.isInteger(value)) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return value.toLocaleString();
  }
  return String(value);
}

function shortenLabel(label: string, max: number = 20): string {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + "\u2026";
}

function stripSortPrefix(label: string): string {
  return label.replace(/^\d+_/, "");
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey?: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-surface border border-rule rounded-sm p-3 text-sm" style={{ boxShadow: "0 2px 8px rgba(28,25,23,0.1)" }}>
      <p className="text-foreground font-semibold mb-1">{label}</p>
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

    const firstCol = columns[0];
    const LABEL_KEY = "_label";
    const EXCLUDED_COLS = /^(hcpcs_code|billing_npi|provider_name|description|city|state|provider_type|claim_month|first_month|last_month)$/i;

    const valueKeys = columns.filter((col, i) => {
      if (EXCLUDED_COLS.test(col)) return false;
      const sample = rows[0]?.[i];
      if ((typeof sample === "number" || typeof sample === "bigint") && Number(sample) >= 1900 && Number(sample) <= 2100) {
        return false;
      }
      return typeof sample === "number" || typeof sample === "bigint";
    });

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

      if (stringColIndices.length >= 2) {
        const parts = stringColIndices
          .map(({ i }) => stripSortPrefix(String(row[i] ?? "").trim()))
          .filter(Boolean);
        record[LABEL_KEY] = shortenLabel(parts.join(": "), 40);
      } else if (stringColIndices.length === 1) {
        const val = String(row[stringColIndices[0].i] ?? "").trim();
        const dateLabel = formatDateCell(val, stringColIndices[0].col);
        record[LABEL_KEY] = dateLabel || shortenLabel(stripSortPrefix(val), 30);
      } else {
        const dateLabel = formatDateCell(record[firstCol], firstCol);
        record[LABEL_KEY] = dateLabel || String(record[firstCol] ?? "");
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
    <div className="card p-3 sm:p-6">
      {showToggles && (
        <div className="flex flex-wrap gap-2 mb-4">
          {valueKeys.map((key, i) => {
            const active = visibleKeys.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleKey(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition-colors border ${
                  active
                    ? "bg-surface border-rule text-foreground"
                    : "bg-background border-rule-light text-muted"
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
          <p className="text-muted text-sm">Select a column to chart</p>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
            <XAxis
              dataKey={labelKey}
              stroke="#78716C"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              angle={-45}
              textAnchor="end"
              height={isMobile ? 80 : 100}
              interval={0}
              tickFormatter={(v) => shortenLabel(String(v), isMobile ? 14 : 28)}
            />
            <YAxis
              stroke="#78716C"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 45 : undefined}
              tickFormatter={(v) => formatValue(v, valueKeys[0])}
            />
            <Tooltip content={<CustomTooltip />} />
            {activeKeys.map((key) => {
              const i = valueKeys.indexOf(key);
              return <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />;
            })}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
            <XAxis
              dataKey={labelKey}
              stroke="#78716C"
              fontSize={isMobile ? 9 : 11}
              tickLine={false}
            />
            <YAxis
              stroke="#78716C"
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
    </div>
  );
}
