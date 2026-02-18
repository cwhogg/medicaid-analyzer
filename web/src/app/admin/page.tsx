"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";

interface FeedbackItem {
  id: string;
  message: string;
  page: string | null;
  ip: string | null;
  timestamp: number;
}

interface Metrics {
  uptime: { startTime: string; seconds: number };
  traffic: {
    totalRequests: number;
    uniqueUsers: number;
    byRoute: Record<string, number>;
    byStatus: Record<string, number>;
    topUsers: { ip: string; city: string | null; count: number }[];
  };
  performance: {
    total: { avg: number; p95: number };
    claude: { avg: number; p95: number };
    railway: { avg: number; p95: number };
    cacheHitRate: number;
    sampleSize: number;
  };
  costs: {
    inputTokens: number;
    outputTokens: number;
    estimatedUSD: number;
    budgetLimit: number;
    budgetPercent: number;
  };
  rateLimit: { trackedIPs: number; limitPerHour: number };
  feedback: FeedbackItem[];
  recentQueries: {
    timestamp: number;
    ip: string;
    route: string;
    question: string;
    sql: string | null;
    status: number;
    totalMs: number;
    cached: boolean;
    error?: string;
    ago: string;
  }[];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSQL, setExpandedSQL] = useState<Set<number>>(new Set());

  const fetchMetrics = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    try {
      const res = await fetch(`/api/admin?key=${encodeURIComponent(key)}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch metrics");
        return;
      }
      const data = await res.json();
      setMetrics(data);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Failed to fetch metrics");
    }
  }, [key]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

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

  if (!metrics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading metrics...</div>
      </div>
    );
  }

  const budgetColor = metrics.costs.budgetPercent >= 80 ? "bg-red-500" : "bg-accent";

  return (
    <div className="min-h-screen bg-background text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">Admin Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Tracking since {new Date(metrics.uptime.startTime).toLocaleDateString()} ({formatUptime(metrics.uptime.seconds)})
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-muted">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">Total Requests</p>
            <p className="text-3xl font-bold font-mono mt-1">{formatNumber(metrics.traffic.totalRequests)}</p>
            <p className="text-xs text-muted mt-1">{metrics.performance.sampleSize} in rolling window</p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">Unique Users</p>
            <p className="text-3xl font-bold font-mono mt-1">{formatNumber(metrics.traffic.uniqueUsers)}</p>
            <p className="text-xs text-muted mt-1">by IP address</p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">Queries / User</p>
            <p className="text-3xl font-bold font-mono mt-1">{metrics.traffic.uniqueUsers > 0 ? (metrics.traffic.totalRequests / metrics.traffic.uniqueUsers).toFixed(1) : "0"}</p>
            <p className="text-xs text-muted mt-1">avg requests per user</p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">Est. Cost</p>
            <p className="text-3xl font-bold font-mono mt-1">
              <span className={metrics.costs.budgetPercent >= 80 ? "text-red-400" : "text-accent"}>
                ${metrics.costs.estimatedUSD.toFixed(2)}
              </span>
            </p>
            <div className="mt-2">
              <div className="w-full h-2 rounded-full bg-white/[0.05]">
                <div
                  className={`h-2 rounded-full transition-all ${budgetColor}`}
                  style={{ width: `${Math.min(metrics.costs.budgetPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted mt-1">{metrics.costs.budgetPercent}% of ${metrics.costs.budgetLimit} limit</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Middle Row: Routes + Response Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Requests by Route</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted/60">
                  <th className="pb-2">Route</th>
                  <th className="pb-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.traffic.byRoute)
                  .sort(([, a], [, b]) => b - a)
                  .map(([route, count]) => (
                    <tr key={route} className="border-t border-white/[0.05]">
                      <td className="py-1.5 font-mono text-xs">{route}</td>
                      <td className="py-1.5 text-right font-mono">{formatNumber(count)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Response Times (ms)</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted/60">
                  <th className="pb-2">Component</th>
                  <th className="pb-2 text-right">Avg</th>
                  <th className="pb-2 text-right">P95</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Total", ...metrics.performance.total },
                  { name: "Claude API", ...metrics.performance.claude },
                  { name: "Railway DB", ...metrics.performance.railway },
                ].map((row) => (
                  <tr key={row.name} className="border-t border-white/[0.05]">
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(row.avg)}</td>
                    <td className="py-1.5 text-right font-mono">{formatNumber(row.p95)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* Third Row: Cost Details + Rate Limit + Status Codes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Token Usage</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Input tokens</span>
                <span className="font-mono">{formatNumber(metrics.costs.inputTokens)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Output tokens</span>
                <span className="font-mono">{formatNumber(metrics.costs.outputTokens)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/[0.05]">
                <span className="text-muted">Raw token cost</span>
                <span className="font-mono">${(metrics.costs.inputTokens * 3 / 1_000_000 + metrics.costs.outputTokens * 15 / 1_000_000).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Est. actual (5x)</span>
                <span className="font-mono">${((metrics.costs.inputTokens * 3 / 1_000_000 + metrics.costs.outputTokens * 15 / 1_000_000) * 5).toFixed(4)}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Rate Limiting</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Tracked IPs</span>
                <span className="font-mono">{metrics.rateLimit.trackedIPs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Limit per hour</span>
                <span className="font-mono">{metrics.rateLimit.limitPerHour}</span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Status Codes</h2>
            <div className="space-y-1.5 text-sm">
              {Object.entries(metrics.traffic.byStatus)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([code, count]) => (
                  <div key={code} className="flex justify-between">
                    <span className={`font-mono ${
                      code.startsWith("2") ? "text-green-400" :
                      code.startsWith("4") ? "text-yellow-400" :
                      "text-red-400"
                    }`}>{code}</span>
                    <span className="font-mono">{formatNumber(count)}</span>
                  </div>
                ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Top Users */}
      {metrics.traffic.topUsers.length > 0 && (
        <GlassCard className="mb-6">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Top Users (masked IPs)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-sm">
              {metrics.traffic.topUsers.map((user, i) => (
                <div key={i} className="flex justify-between items-start bg-white/[0.02] rounded px-2.5 py-1.5 gap-2">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-muted block">{user.ip}</span>
                    {user.city && <span className="text-[10px] text-muted-dark block mt-0.5">{user.city}</span>}
                  </div>
                  <span className="font-mono text-xs font-semibold shrink-0">{user.count}</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Sentry Link */}
      <GlassCard className="mb-6">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Error Monitoring</h2>
            <p className="text-xs text-muted/60 mt-1">View errors and performance in Sentry</p>
          </div>
          <a
            href="https://woggner-llc.sentry.io/projects/medicaid-analyzer/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
          >
            Open Sentry &rarr;
          </a>
        </div>
      </GlassCard>

      {/* Feedback */}
      {metrics.feedback && metrics.feedback.length > 0 && (
        <GlassCard className="mb-6">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              User Feedback ({metrics.feedback.length})
            </h2>
            <div className="space-y-3">
              {metrics.feedback.map((fb) => (
                <div key={fb.id} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]">
                  <p className="text-sm text-white whitespace-pre-wrap">{fb.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted/60">
                    <span>{new Date(fb.timestamp).toLocaleString()}</span>
                    {fb.page && <span className="font-mono">{fb.page}</span>}
                    {fb.ip && <span className="font-mono">{fb.ip}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Recent Queries */}
      <GlassCard>
        <div className="p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Recent Queries ({metrics.recentQueries.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted/60">
                  <th className="pb-2 pr-3">Time</th>
                  <th className="pb-2 pr-3">Route</th>
                  <th className="pb-2 pr-3">Question</th>
                  <th className="pb-2 pr-3">SQL</th>
                  <th className="pb-2 pr-3 text-right">Status</th>
                  <th className="pb-2 pr-3 text-right">Latency</th>
                  <th className="pb-2">Cache</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentQueries.map((q, i) => (
                  <tr key={i} className="border-t border-white/[0.05] align-top">
                    <td className="py-2 pr-3 text-muted whitespace-nowrap">{q.ago}</td>
                    <td className="py-2 pr-3 font-mono text-muted">{q.route.replace("/api/", "")}</td>
                    <td className="py-2 pr-3 max-w-[300px] truncate">{q.question}</td>
                    <td className="py-2 pr-3 max-w-[200px]">
                      {q.sql ? (
                        <button
                          onClick={() => {
                            const next = new Set(expandedSQL);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            setExpandedSQL(next);
                          }}
                          className="text-accent hover:underline text-left"
                        >
                          {expandedSQL.has(i) ? (
                            <pre className="whitespace-pre-wrap font-mono text-xs text-white/80 max-w-[400px]">{q.sql}</pre>
                          ) : (
                            "Show SQL"
                          )}
                        </button>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </td>
                    <td className={`py-2 pr-3 text-right font-mono ${
                      q.status < 300 ? "text-green-400" :
                      q.status < 500 ? "text-yellow-400" :
                      "text-red-400"
                    }`}>{q.status}</td>
                    <td className="py-2 pr-3 text-right font-mono">{formatNumber(q.totalMs)}ms</td>
                    <td className="py-2">
                      {q.cached ? (
                        <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">HIT</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.03] text-muted text-xs">MISS</span>
                      )}
                    </td>
                  </tr>
                ))}
                {metrics.recentQueries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted/40">
                      No queries recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading...</div>
      </div>
    }>
      <AdminDashboard />
    </Suspense>
  );
}
