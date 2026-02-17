"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, FileText, Users, Hash, Calendar, Loader2, AlertCircle, UserCheck, BarChart3, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ResultsTable } from "@/components/analyze/ResultsTable";
import { ResultsChart } from "@/components/analyze/ResultsChart";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCurrency, formatFullNumber } from "@/lib/format";

interface ProviderData {
  npi: string;
  info: {
    name: string | null;
    type: string | null;
    city: string | null;
    state: string | null;
  };
  summary: {
    total_paid: number | null;
    total_claims: number | null;
    unique_beneficiaries: number | null;
    procedures_billed: number | null;
    first_month: string | null;
    last_month: string | null;
  };
  procedures: { columns: string[]; rows: unknown[][] };
  trend: { columns: string[]; rows: unknown[][] };
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <GlassCard className="p-3 sm:p-4">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10 shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs text-muted-dark uppercase tracking-wider truncate">{label}</p>
          <p className="text-sm sm:text-lg font-semibold text-white font-mono truncate">{value}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

const ALL_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];

export default function ProviderPage({ params }: { params: { npi: string } }) {
  const { npi } = params;
  const router = useRouter();
  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());

  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    async function fetchProvider() {
      setLoading(true);
      setError(null);

      try {
        const yearsQuery = selectedYears.size > 0
          ? `?years=${Array.from(selectedYears).sort().join(",")}`
          : "";
        const res = await fetch(`/api/provider/${npi}${yearsQuery}`);
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || `Error ${res.status}`);
          return;
        }

        setData(json);
      } catch {
        setError("Failed to load provider data.");
      } finally {
        setLoading(false);
      }
    }

    fetchProvider();
  }, [npi, selectedYears]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {/* Loading state */}
          {loading && (
            <div className="glass-card p-16 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
              <p className="text-sm text-muted">Loading provider data...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="glass-card p-8 flex flex-col items-center gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Data loaded */}
          {data && !loading && (
            <div className="space-y-8">
              {/* Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  {data.info.name || `Provider ${npi}`}
                </h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {data.info.type && (
                    <span className="px-2.5 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium">
                      {data.info.type}
                    </span>
                  )}
                  {(data.info.city || data.info.state) && (
                    <span className="text-sm text-muted">
                      {[data.info.city, data.info.state].filter(Boolean).join(", ")}
                    </span>
                  )}
                  <span className="text-sm text-muted-dark font-mono">NPI: {npi}</span>
                </div>
              </div>

              {/* Year selector */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedYears(new Set())}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                    selectedYears.size === 0
                      ? "bg-accent text-white border-accent"
                      : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                  )}
                >
                  All Time
                </button>
                {ALL_YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => toggleYear(y)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                      selectedYears.has(y)
                        ? "bg-accent text-white border-accent"
                        : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                <StatCard
                  icon={DollarSign}
                  label="Total Spending"
                  value={data.summary.total_paid != null ? formatCurrency(data.summary.total_paid) : "N/A"}
                />
                <StatCard
                  icon={FileText}
                  label="Total Claims"
                  value={data.summary.total_claims != null ? formatFullNumber(data.summary.total_claims) : "N/A"}
                />
                <StatCard
                  icon={Users}
                  label="Beneficiaries"
                  value={data.summary.unique_beneficiaries != null ? formatFullNumber(data.summary.unique_beneficiaries) : "N/A"}
                />
                <StatCard
                  icon={Hash}
                  label="Unique Codes"
                  value={data.summary.procedures_billed != null ? formatFullNumber(data.summary.procedures_billed) : "N/A"}
                />
                <StatCard
                  icon={UserCheck}
                  label="$ / Bene / Yr"
                  value={data.summary.total_paid != null && data.summary.unique_beneficiaries && data.summary.first_month && data.summary.last_month
                    ? (() => {
                        const months = (new Date(data.summary.last_month).getTime() - new Date(data.summary.first_month).getTime()) / (1000 * 60 * 60 * 24 * 30.44) + 1;
                        const years = Math.max(1, months / 12);
                        return formatCurrency(data.summary.total_paid / data.summary.unique_beneficiaries / years);
                      })()
                    : "N/A"}
                />
                <StatCard
                  icon={BarChart3}
                  label="$ / Claim"
                  value={data.summary.total_paid != null && data.summary.total_claims
                    ? formatCurrency(data.summary.total_paid / data.summary.total_claims)
                    : "N/A"}
                />
                <StatCard
                  icon={Clock}
                  label="Active Years"
                  value={data.summary.first_month && data.summary.last_month
                    ? (() => {
                        const months = (new Date(data.summary.last_month).getTime() - new Date(data.summary.first_month).getTime()) / (1000 * 60 * 60 * 24 * 30.44) + 1;
                        const years = months / 12;
                        return years >= 1 ? `${years.toFixed(1)} yrs` : `${Math.round(months)} mo`;
                      })()
                    : "N/A"}
                />
                <StatCard
                  icon={TrendingUp}
                  label="Avg $ / Month"
                  value={data.summary.total_paid != null && data.summary.first_month && data.summary.last_month
                    ? (() => {
                        const months = Math.max(1, Math.round((new Date(data.summary.last_month).getTime() - new Date(data.summary.first_month).getTime()) / (1000 * 60 * 60 * 24 * 30.44)) + 1);
                        return formatCurrency(data.summary.total_paid / months);
                      })()
                    : "N/A"}
                />
              </div>

              {/* Active period */}
              {(data.summary.first_month || data.summary.last_month) && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Calendar className="w-4 h-4 text-muted-dark" />
                  <span>
                    Active: {formatMonth(data.summary.first_month)} &mdash; {formatMonth(data.summary.last_month)}
                  </span>
                </div>
              )}

              {/* Monthly Trend */}
              {data.trend.rows.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Monthly Spending Trend</h2>
                  <ResultsChart
                    columns={data.trend.columns}
                    rows={data.trend.rows}
                    chartType="line"
                  />
                </div>
              )}

              {/* Top Procedures */}
              {data.procedures.rows.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Top Procedures</h2>
                  <ResultsTable
                    columns={data.procedures.columns}
                    rows={data.procedures.rows}
                    title={`${data.info.name || data.npi} top procedures`}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
