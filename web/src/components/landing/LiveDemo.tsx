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
    <div className="bg-surface border border-rule rounded-sm p-3 text-sm" style={{ boxShadow: "0 2px 8px rgba(28,25,23,0.1)" }}>
      <p className="text-foreground font-semibold">{formatMonth(label)}</p>
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
    const CUTOFF = "2024-10-01";
    fetch("/data/monthly_trend.json")
      .then((r) => r.json())
      .then((rows: MonthlyTrend[]) => setData(rows.filter((r) => r.month < CUTOFF)))
      .catch(console.error);
  }, []);

  if (!data.length) return null;

  return (
    <section className="max-w-[1080px] mx-auto px-4 sm:px-8 pb-12">
      <div className="section-label">Monthly Medicaid Spending Trends</div>
      <div className="card p-4 sm:p-6 md:p-8 max-w-[760px] mx-auto">
        <h3 className="font-headline text-[1.1875rem] font-bold text-foreground mb-1 leading-tight">
          Annual Medicaid Provider Spending, 2018&ndash;2024
        </h3>
        <p className="font-subhead italic text-[0.875rem] text-muted mb-6">
          Total payments to Medicaid providers by month, in dollars
        </p>

        <ResponsiveContainer width="100%" height={isMobile ? 260 : 400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              stroke="#78716C"
              fontSize={isMobile ? 10 : 12}
              tickLine={false}
              interval={isMobile ? 17 : 11}
            />
            <YAxis
              tickFormatter={(v) => formatCurrency(v)}
              stroke="#78716C"
              fontSize={isMobile ? 10 : 12}
              tickLine={false}
              axisLine={false}
              width={isMobile ? 55 : 80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="total_paid"
              stroke="#B91C1C"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#B91C1C" }}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="text-[0.75rem] text-muted mt-5 pt-3 border-t border-rule-light leading-relaxed">
          <strong className="text-body font-semibold">Data Source:</strong> CMS Medicaid Provider Utilization and Payment Data, 2018&ndash;2024. Figures represent total monthly Medicaid provider payments.
        </div>
      </div>
    </section>
  );
}
