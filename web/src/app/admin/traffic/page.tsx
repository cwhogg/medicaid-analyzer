"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface SourceEntry {
  source: string;
  views: number;
}

interface DomainEntry {
  domain: string;
  views: number;
}

interface PageEntry {
  path: string;
  views: number;
}

interface DailyEntry {
  day: string;
  views: number;
  uniqueVisitors: number;
}

interface CampaignEntry {
  campaign: string;
  source: string;
  views: number;
}

interface BlogEntry {
  path: string;
  views: number;
  fromTwitter: number;
  fromGoogle: number;
  fromDirect: number;
}

interface TrafficData {
  total: number;
  days: number;
  sources: SourceEntry[];
  domains: DomainEntry[];
  topPages: PageEntry[];
  daily: DailyEntry[];
  campaigns: CampaignEntry[];
  blogPosts: BlogEntry[];
}

const SOURCE_COLORS: Record<string, string> = {
  twitter: "#1DA1F2",
  google: "#4285F4",
  search_other: "#34A853",
  direct: "#9CA3AF",
  referral: "#EA580C",
};

const SOURCE_LABELS: Record<string, string> = {
  twitter: "Twitter/X",
  google: "Google",
  search_other: "Other Search",
  direct: "Direct",
  referral: "Referral",
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function TrafficPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/traffic?key=${encodeURIComponent(key)}&days=${days}`
      );
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch traffic data");
        return;
      }
      const result = await res.json();
      setData(result);
      setError(null);
    } catch {
      setError("Failed to fetch traffic data");
    } finally {
      setLoading(false);
    }
  }, [key, days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading traffic data...</div>
      </div>
    );
  }

  const pieData = data.sources.map((s) => ({
    name: SOURCE_LABELS[s.source] || s.source,
    value: s.views,
    color: SOURCE_COLORS[s.source] || "#6B7280",
  }));

  const chartDaily = [...data.daily].reverse();

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-teal hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-headline font-bold">Traffic Sources</h1>
        <span className="text-sm text-muted">
          {formatNumber(data.total)} page views
        </span>
      </div>

      {/* Time range selector */}
      <div className="flex gap-2 mb-6">
        {[7, 14, 30, 60, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              days === d
                ? "bg-accent text-white"
                : "bg-white/[0.05] text-muted hover:text-foreground"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {data.total === 0 ? (
        <div className="card p-8 text-center text-muted">
          No page views recorded yet. Data will appear once the tracker is live.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Source Breakdown + Daily Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Traffic Sources
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Source table */}
              <div className="mt-2 space-y-1">
                {data.sources.map((s) => (
                  <div key={s.source} className="flex justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{
                          backgroundColor:
                            SOURCE_COLORS[s.source] || "#6B7280",
                        }}
                      />
                      {SOURCE_LABELS[s.source] || s.source}
                    </span>
                    <span className="font-mono">{formatNumber(s.views)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily views chart */}
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-4">
                Daily Page Views
              </h2>
              {chartDaily.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      tickFormatter={(d) => d.slice(5)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1a1a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px" }} />
                    <Bar dataKey="views" fill="#EA580C" name="Views" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="uniqueVisitors" fill="#6B7280" name="Unique" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted text-xs text-center py-8">No daily data</p>
              )}
            </div>
          </div>

          {/* Top Pages + Referrer Domains */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top pages */}
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Top Pages
              </h2>
              <div className="space-y-1">
                {data.topPages.slice(0, 15).map((p, i) => (
                  <div
                    key={p.path}
                    className="flex justify-between text-xs items-center"
                  >
                    <span className="truncate max-w-[300px]">
                      <span className="text-muted mr-2">{i + 1}.</span>
                      {p.path}
                    </span>
                    <span className="font-mono text-muted ml-2">
                      {formatNumber(p.views)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Referrer domains */}
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Referrer Domains
              </h2>
              <div className="space-y-1">
                {data.domains.slice(0, 15).map((d, i) => (
                  <div
                    key={d.domain}
                    className="flex justify-between text-xs items-center"
                  >
                    <span>
                      <span className="text-muted mr-2">{i + 1}.</span>
                      {d.domain}
                    </span>
                    <span className="font-mono text-muted ml-2">
                      {formatNumber(d.views)}
                    </span>
                  </div>
                ))}
                {data.domains.length === 0 && (
                  <p className="text-muted text-xs">No referrer data yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Blog Post Performance */}
          {data.blogPosts.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Blog Post Performance (by source)
              </h2>
              <div className="relative">
                <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="pb-2 pr-3">#</th>
                        <th className="pb-2 pr-3">Post</th>
                        <th className="pb-2 pr-3 text-right">Total</th>
                        <th className="pb-2 pr-3 text-right">Twitter</th>
                        <th className="pb-2 pr-3 text-right">Google</th>
                        <th className="pb-2 text-right">Direct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.blogPosts.map((b, i) => {
                        const slug = b.path.replace("/blog/", "");
                        return (
                          <tr key={b.path} className="border-t border-rule-light">
                            <td className="py-2 pr-3 text-muted font-mono text-xs">
                              {i + 1}
                            </td>
                            <td className="py-2 pr-3 text-xs max-w-[300px] truncate">
                              {slug}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-xs font-semibold">
                              {formatNumber(b.views)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-xs" style={{ color: "#1DA1F2" }}>
                              {formatNumber(b.fromTwitter)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono text-xs" style={{ color: "#4285F4" }}>
                              {formatNumber(b.fromGoogle)}
                            </td>
                            <td className="py-2 text-right font-mono text-xs text-muted">
                              {formatNumber(b.fromDirect)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* UTM Campaigns */}
          {data.campaigns.length > 0 && (
            <div className="card p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                UTM Campaigns
              </h2>
              <div className="space-y-1">
                {data.campaigns.map((c, i) => (
                  <div
                    key={`${c.campaign}-${c.source}`}
                    className="flex justify-between text-xs items-center"
                  >
                    <span className="truncate max-w-[400px]">
                      <span className="text-muted mr-2">{i + 1}.</span>
                      {c.campaign}
                      <span className="text-muted ml-1">({c.source})</span>
                    </span>
                    <span className="font-mono text-muted ml-2">
                      {formatNumber(c.views)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminTrafficPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <TrafficPage />
    </Suspense>
  );
}
