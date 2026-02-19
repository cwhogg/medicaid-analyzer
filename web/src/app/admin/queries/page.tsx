"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";

interface DaySummary {
  day: string;
  queryCount: number;
  uniqueUsers: number;
}

interface Query {
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
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function QueriesPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [days, setDays] = useState<DaySummary[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drillLoading, setDrillLoading] = useState(false);
  const [expandedSQL, setExpandedSQL] = useState<Set<number>>(new Set());

  const fetchDays = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    try {
      const res = await fetch(`/api/admin/queries?key=${encodeURIComponent(key)}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch queries");
        return;
      }
      const data = await res.json();
      setDays(data.days || []);
      setError(null);
    } catch {
      setError("Failed to fetch queries");
    } finally {
      setLoading(false);
    }
  }, [key]);

  const fetchDayQueries = useCallback(
    async (day: string) => {
      if (!key) return;
      setDrillLoading(true);
      try {
        const res = await fetch(
          `/api/admin/queries?key=${encodeURIComponent(key)}&day=${encodeURIComponent(day)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        setQueries(data.queries || []);
        setSelectedDay(day);
        setExpandedSQL(new Set());
      } catch {
        // Silently fail drill-down
      } finally {
        setDrillLoading(false);
      }
    },
    [key]
  );

  useEffect(() => {
    fetchDays();
  }, [fetchDays]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading queries...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-accent hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-bold font-heading">Daily Queries</h1>
      </div>

      {/* Day summary table */}
      <GlassCard className="mb-6">
        <div className="p-4 overflow-x-auto">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Last {days.length} Days
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted/60">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4 text-right">Queries</th>
                <th className="pb-2 pr-4 text-right">Unique Users</th>
                <th className="pb-2 pr-4 text-right">Queries/User</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr
                  key={d.day}
                  className={`border-t border-white/[0.05] cursor-pointer hover:bg-white/[0.03] ${
                    selectedDay === d.day ? "bg-white/[0.05]" : ""
                  }`}
                  onClick={() => fetchDayQueries(d.day)}
                >
                  <td className="py-2 pr-4 font-mono text-xs">{d.day}</td>
                  <td className="py-2 pr-4 text-right font-mono font-semibold">
                    {formatNumber(d.queryCount)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {formatNumber(d.uniqueUsers)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-muted">
                    {d.uniqueUsers > 0 ? (d.queryCount / d.uniqueUsers).toFixed(1) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <span className="text-accent text-xs">
                      {selectedDay === d.day ? "selected" : "view"}
                    </span>
                  </td>
                </tr>
              ))}
              {days.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted/40">
                    No query data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Drill-down: individual queries for selected day */}
      {selectedDay && (
        <GlassCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Queries on {selectedDay} ({queries.length})
              </h2>
              <button
                onClick={() => {
                  setSelectedDay(null);
                  setQueries([]);
                }}
                className="text-xs text-muted hover:text-white"
              >
                Close
              </button>
            </div>

            {drillLoading ? (
              <div className="py-8 text-center animate-pulse text-muted">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted/60">
                      <th className="pb-2 pr-3">Time</th>
                      <th className="pb-2 pr-3">IP</th>
                      <th className="pb-2 pr-3">Route</th>
                      <th className="pb-2 pr-3">Question</th>
                      <th className="pb-2 pr-3">SQL</th>
                      <th className="pb-2 pr-3 text-right">Status</th>
                      <th className="pb-2 pr-3 text-right">Latency</th>
                      <th className="pb-2">Cache</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queries.map((q, i) => (
                      <tr key={i} className="border-t border-white/[0.05] align-top">
                        <td className="py-2 pr-3 text-muted whitespace-nowrap font-mono">
                          {formatTime(q.timestamp)}
                        </td>
                        <td className="py-2 pr-3 font-mono text-muted">{q.ip}</td>
                        <td className="py-2 pr-3 font-mono text-muted">
                          {q.route.replace("/api/", "")}
                        </td>
                        <td className="py-2 pr-3 max-w-[250px] truncate">{q.question}</td>
                        <td className="py-2 pr-3 max-w-[200px]">
                          {q.sql ? (
                            <button
                              onClick={() => {
                                const next = new Set(expandedSQL);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                setExpandedSQL(next);
                              }}
                              className="text-accent hover:underline text-left"
                            >
                              {expandedSQL.has(i) ? (
                                <pre className="whitespace-pre-wrap font-mono text-xs text-white/80 max-w-[400px]">
                                  {q.sql}
                                </pre>
                              ) : (
                                "Show SQL"
                              )}
                            </button>
                          ) : (
                            <span className="text-muted/40">&mdash;</span>
                          )}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${
                            q.status < 300
                              ? "text-green-400"
                              : q.status < 500
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {q.status}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">
                          {formatNumber(q.totalMs)}ms
                        </td>
                        <td className="py-2">
                          {q.cached ? (
                            <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                              HIT
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.03] text-muted text-xs">
                              MISS
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {queries.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted/40">
                          No queries on this day
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

export default function AdminQueriesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <QueriesPage />
    </Suspense>
  );
}
