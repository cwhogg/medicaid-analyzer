"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
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
import { Download } from "lucide-react";
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

function isCountColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /discharge|claims|srvcs|services|beneficiar|benes|fills|supply|_cnt|_count|respondent|population|member|participant|_n$|^n_|^tot_benes|^tot_srvcs|^tot_clms|^tot_dschrgs/.test(lower);
}

function isDollarColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /paid|spending|cost|amount|payment|charge|price|pymt|chrg|drug_cst/.test(lower);
}

function isDecimalColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /avg|mean|average|rate|pct|percent|prevalence|ratio|proportion|per_/.test(lower);
}

function formatValue(value: unknown, colName?: string): string {
  if (typeof value === "number") {
    const count = colName ? isCountColumn(colName) : false;
    const dollar = colName ? !count && isDollarColumn(colName) : false;
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

function formatColumnLabel(col: string): string {
  return col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  const chartRef = useRef<HTMLDivElement>(null);

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

  // Reset visible keys when valueKeys change (sample_n hidden by default)
  useEffect(() => {
    setVisibleKeys(new Set(valueKeys.filter((k) => !/^sample_n$/i.test(k))));
  }, [valueKeys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeKeys = useMemo(() => {
    const filtered = valueKeys.filter((k) => visibleKeys.has(k));
    return filtered;
  }, [valueKeys, visibleKeys]);

  // Label dimension: name of the category axis (first string column)
  const labelDimension = useMemo(() => {
    if (!columns.length || !rows.length) return "";
    const firstStringCol = columns.find((_, i) => typeof rows[0]?.[i] === "string");
    return firstStringCol ? formatColumnLabel(firstStringCol) : formatColumnLabel(columns[0]);
  }, [columns, rows]);

  // Dynamic chart title
  const chartTitle = useMemo(() => {
    if (activeKeys.length === 0) return "";
    const values = activeKeys.map(formatColumnLabel);
    if (chartType === "pie") return `${values[0]} Distribution`;
    if (values.length === 1) return `${values[0]} by ${labelDimension}`;
    return `${values.join(", ")} by ${labelDimension}`;
  }, [activeKeys, labelDimension, chartType]);

  // Y-axis label (first active key, formatted)
  const yAxisLabel = useMemo(() => {
    if (activeKeys.length === 0) return "";
    return formatColumnLabel(activeKeys[0]);
  }, [activeKeys]);

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

  // Download chart as PNG
  const downloadChart = useCallback(async () => {
    const container = chartRef.current;
    if (!container) return;

    const svgEl = container.querySelector(".recharts-wrapper svg");
    if (!svgEl) return;

    try {
      const svgRect = svgEl.getBoundingClientRect();
      const scale = 2;
      const pad = 24;
      const titleH = chartTitle ? 36 : 0;
      const wmH = 28;
      const canvasW = svgRect.width + pad * 2;
      const canvasH = svgRect.height + titleH + wmH + pad * 2;

      // Clone SVG and ensure proper attributes
      const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgClone.setAttribute("width", String(svgRect.width));
      svgClone.setAttribute("height", String(svgRect.height));

      // Serialize SVG to data URL
      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svgClone);
      const svgDataUrl =
        "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

      // Load SVG as image
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = svgDataUrl;
      });

      // Create canvas and draw
      const canvas = document.createElement("canvas");
      canvas.width = canvasW * scale;
      canvas.height = canvasH * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = "#FAFAF9";
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Title
      if (chartTitle) {
        ctx.fillStyle = "#1C1917";
        ctx.font = "600 14px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(chartTitle, pad, pad + 20);
      }

      // Chart SVG
      ctx.drawImage(img, pad, pad + titleH, svgRect.width, svgRect.height);

      // Watermark
      ctx.fillStyle = "#A8A29E";
      ctx.font = "10px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        "Open Health Data Hub \u00B7 openhealthdatahub.com",
        canvasW - pad,
        canvasH - pad / 2 + 2
      );

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const slug = chartTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        a.download = `${slug || "chart"}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } catch {
      // Fallback: open chart SVG in new tab
      console.warn("Chart export failed");
    }
  }, [chartTitle]);

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
      <div ref={chartRef}>
        {/* Title + download button */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground truncate mr-2">
            {chartTitle}
          </h3>
          <button
            onClick={downloadChart}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs text-muted hover:text-foreground hover:bg-surface border border-transparent hover:border-rule transition-colors flex-shrink-0"
            title="Download chart as PNG"
          >
            <Download size={13} />
            <span className="hidden sm:inline">PNG</span>
          </button>
        </div>

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
                width={isMobile ? 55 : 70}
                tickFormatter={(v) => formatValue(v, activeKeys[0] || valueKeys[0])}
                label={!isMobile && yAxisLabel ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  offset: 4,
                  style: { fontSize: 11, fill: "#78716C", textAnchor: "middle" },
                } : undefined}
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
                width={isMobile ? 55 : 70}
                tickFormatter={(v) => formatValue(v, activeKeys[0] || valueKeys[0])}
                label={!isMobile && yAxisLabel ? {
                  value: yAxisLabel,
                  angle: -90,
                  position: "insideLeft",
                  offset: 4,
                  style: { fontSize: 11, fill: "#78716C", textAnchor: "middle" },
                } : undefined}
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

        {/* Watermark */}
        <p className="text-right mt-1 pr-2 text-[10px] text-stone-400 tracking-wide select-none">
          Open Health Data Hub &middot; openhealthdatahub.com
        </p>
      </div>
      )}
    </div>
  );
}
