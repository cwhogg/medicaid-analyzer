"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";

interface CohortRow {
  dayNumber: number;
  retained: number;
  total: number;
}

interface Engagement {
  total: number;
  gte2: number;
  gte5: number;
  gte10: number;
  gte25: number;
  gte50: number;
}

interface Recency {
  total: number;
  last1d: number;
  last7d: number;
  last14d: number;
  last30d: number;
  last60d: number;
  multiDayUsers: number;
}

interface RetentionData {
  cohort: CohortRow[];
  engagement: Engagement;
  recency: Recency;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return `${((n / total) * 100).toFixed(1)}%`;
}

function ProgressBar({ value, max, color = "bg-accent" }: { value: number; max: number; color?: string }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-white/[0.05]">
      <div
        className={`h-2 rounded-full transition-all ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function RetentionPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [data, setData] = useState<RetentionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRetention = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    try {
      const res = await fetch(`/api/admin/retention?key=${encodeURIComponent(key)}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch retention data");
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Failed to fetch retention data");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchRetention();
  }, [fetchRetention]);

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted">Not found</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading retention...</div>
      </div>
    );
  }

  const { cohort, engagement, recency } = data;
  const d0 = cohort.find((c) => c.dayNumber === 0);
  const totalUsers = d0?.total || engagement.total || 1;

  return (
    <div className="min-h-screen bg-background text-white p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-accent hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-bold font-heading">Retention</h1>
        <span className="text-sm text-muted">({totalUsers} total users)</span>
      </div>

      {/* Day-over-day cohort retention */}
      <GlassCard className="mb-6">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
            Day-over-Day Retention (D0 &ndash; D30)
          </h2>
          <div className="space-y-1">
            {cohort.map((row) => (
              <div key={row.dayNumber} className="flex items-center gap-3 text-sm">
                <span className="w-8 text-right text-muted font-mono text-xs">
                  D{row.dayNumber}
                </span>
                <div className="flex-1">
                  <ProgressBar value={row.retained} max={totalUsers} />
                </div>
                <span className="w-12 text-right font-mono text-xs">{row.retained}</span>
                <span className="w-14 text-right font-mono text-xs text-muted">
                  {pct(row.retained, totalUsers)}
                </span>
              </div>
            ))}
            {cohort.length === 0 && (
              <p className="text-center text-muted/40 py-4">No cohort data available</p>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Engagement buckets */}
        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Engagement Depth
            </h2>
            <p className="text-3xl font-bold font-mono mb-4">{engagement.total}</p>
            <p className="text-xs text-muted mb-4">total users</p>

            <div className="space-y-3">
              {[
                { label: "2+ queries", value: engagement.gte2 },
                { label: "5+ queries", value: engagement.gte5 },
                { label: "10+ queries", value: engagement.gte10 },
                { label: "25+ queries", value: engagement.gte25 },
                { label: "50+ queries", value: engagement.gte50 },
              ].map((bucket) => (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">{bucket.label}</span>
                    <span className="font-mono">
                      {bucket.value}{" "}
                      <span className="text-muted text-xs">
                        ({pct(bucket.value, engagement.total)})
                      </span>
                    </span>
                  </div>
                  <ProgressBar value={bucket.value} max={engagement.total} color="bg-accent" />
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* User recency */}
        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              User Recency
            </h2>
            <div className="flex gap-6 mb-4">
              <div>
                <p className="text-3xl font-bold font-mono">{recency.multiDayUsers}</p>
                <p className="text-xs text-muted">multi-day users</p>
              </div>
              <div>
                <p className="text-3xl font-bold font-mono text-muted">
                  {pct(recency.multiDayUsers, recency.total)}
                </p>
                <p className="text-xs text-muted">of {recency.total} total</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Active today", value: recency.last1d },
                { label: "Active last 7 days", value: recency.last7d },
                { label: "Active last 14 days", value: recency.last14d },
                { label: "Active last 30 days", value: recency.last30d },
                { label: "Active last 60 days", value: recency.last60d },
              ].map((bucket) => (
                <div key={bucket.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted">{bucket.label}</span>
                    <span className="font-mono">
                      {bucket.value}{" "}
                      <span className="text-muted text-xs">
                        ({pct(bucket.value, recency.total)})
                      </span>
                    </span>
                  </div>
                  <ProgressBar
                    value={bucket.value}
                    max={recency.total}
                    color="bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function AdminRetentionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <RetentionPage />
    </Suspense>
  );
}
