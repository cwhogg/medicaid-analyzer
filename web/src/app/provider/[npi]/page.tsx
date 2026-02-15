"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, DollarSign, FileText, Users, Hash, Calendar, Loader2, AlertCircle, UserCheck, BarChart3, Clock, TrendingUp } from "lucide-react";
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
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/10">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-xs text-muted-dark uppercase tracking-wider">{label}</p>
          <p className="text-lg font-semibold text-white font-mono">{value}</p>
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

export default function ProviderPage({ params }: { params: { npi: string } }) {
  const { npi } = params;
  const router = useRouter();
  const [data, setData] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProvider() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/provider/${npi}`);
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
  }, [npi]);

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
                <h1 className="text-3xl font-bold text-white">
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

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
