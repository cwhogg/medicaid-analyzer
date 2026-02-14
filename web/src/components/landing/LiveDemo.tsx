"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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

export function LiveDemo() {
  const [data, setData] = useState<MonthlyTrend[]>([]);

  useEffect(() => {
    fetch("/data/monthly_trend.json")
      .then((r) => r.json())
      .then(setData)
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
            Medicaid provider spending from January 2018 to December 2024
          </p>
        </div>

        <GlassCard className="p-6 sm:p-8">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonth}
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                interval={11}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                stroke="#6B7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
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
      </div>
    </section>
  );
}
