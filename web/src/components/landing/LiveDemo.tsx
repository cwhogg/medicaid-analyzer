"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ExternalLink } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCurrency } from "@/lib/format";

interface MonthlyTrend {
  month: string;
  total_paid: number;
  total_claims: number;
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "2-digit", month: "short" });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload || !payload.length || !label) return null;
  return (
    <div className="glass-card p-3 text-sm">
      <p className="text-white font-medium">{formatMonth(label)}</p>
      <p className="text-accent">{formatCurrency(payload[0].value)}</p>
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

export function LiveDemo() {
  const [data, setData] = useState<MonthlyTrend[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Oct-Dec 2024 data is incomplete — always truncate at Sept 2024
    const CUTOFF = "2024-10-01";
    fetch("/data/monthly_trend.json")
      .then((r) => r.json())
      .then((rows: MonthlyTrend[]) => setData(rows.filter((r) => r.month < CUTOFF)))
      .catch(console.error);
  }, []);

  if (!data.length) return null;

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Monthly Spending Trends
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto">
            Medicaid provider spending from January 2018 to September 2024
          </p>
        </div>

        <GlassCard className="p-4 sm:p-6 md:p-8">
          <ResponsiveContainer width="100%" height={isMobile ? 260 : 400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                stroke="#6B7280"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                interval={isMobile ? 17 : 11}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                stroke="#6B7280"
                fontSize={isMobile ? 10 : 12}
                tickLine={false}
                axisLine={false}
                width={isMobile ? 55 : 80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="total_paid"
                stroke="#EA580C"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#EA580C" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="mt-6 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Data Source</p>
              <p className="text-sm text-muted mt-1">
                CMS Medicaid Provider Utilization and Spending dataset. 227M+ claims records covering 617K+ providers and 10K+ procedure codes, January 2018 through September 2024.
              </p>
            </div>
            <a
              href="https://opendata.hhs.gov/datasets/medicaid-provider-spending/"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
            >
              View on HHS Open Data
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </GlassCard>

        <div className="mt-8 text-center space-y-2">
          <p className="text-sm font-medium text-accent">Government Open Data FTW</p>
          <p className="text-xs text-muted-dark">
            Made by Claude Code (with guidance from{" "}
            <a
              href="https://x.com/cwhogg"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-white transition-colors"
            >
              Chris Hogg
            </a>
            )
          </p>
        </div>
      </div>
    </section>
  );
}
