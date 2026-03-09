"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface DaySummary {
  day: string;
  queryCount: number;
  uniqueUsers: number;
  medicaid: number;
  brfss: number;
  medicare: number;
  nhanes: number;
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
        <p className="text-red-700">{error}</p>
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
    <div className="min-h-screen bg-background text-foreground px-4 py-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-teal hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-headline font-bold">Daily Queries</h1>
      </div>

      {/* Day summary table */}
      <div className="card mb-6 p-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Last {days.length} Days
        </h2>
        <div className="relative">
          <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4 text-right">Queries</th>
              <th className="pb-2 pr-4 text-right">Unique Users</th>
              <th className="pb-2 pr-3 text-right" style={{ color: "#B91C1C" }}>Med&apos;caid</th>
              <th className="pb-2 pr-3 text-right" style={{ color: "#0F766E" }}>Med&apos;care</th>
              <th className="pb-2 pr-3 text-right" style={{ color: "#1D4ED8" }}>BRFSS</th>
              <th className="pb-2 pr-3 text-right" style={{ color: "#7C3AED" }}>NHANES</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr
                key={d.day}
                className={`border-t border-rule-light cursor-pointer hover:bg-[#F5F5F0] ${
                  selectedDay === d.day ? "bg-[#F5F5F0]" : ""
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
                <td className="py-2 pr-3 text-right font-mono text-muted">
                  {d.medicaid || 0}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-muted">
                  {d.medicare || 0}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-muted">
                  {d.brfss || 0}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-muted">
                  {d.nhanes || 0}
                </td>
                <td className="py-2 text-right">
                  <span className="text-teal text-xs">
                    {selectedDay === d.day ? "selected" : "view"}
                  </span>
                </td>
              </tr>
            ))}
            {days.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-muted">
                  No query data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      </div>

      {/* Drill-down: individual queries for selected day */}
      {selectedDay && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Queries on {selectedDay} ({queries.length})
            </h2>
            <button
              onClick={() => {
                setSelectedDay(null);
                setQueries([]);
              }}
              className="text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>

          {drillLoading ? (
            <div className="py-8 text-center animate-pulse text-muted">Loading...</div>
          ) : (
            <div className="relative">
              <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="text-left text-muted">
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
                    <tr key={i} className="border-t border-rule-light align-top">
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
                            className="text-teal hover:underline text-left"
                          >
                            {expandedSQL.has(i) ? (
                              <pre className="whitespace-pre-wrap font-mono text-xs text-body max-w-[400px]">
                                {q.sql}
                              </pre>
                            ) : (
                              "Show SQL"
                            )}
                          </button>
                        ) : (
                          <span className="text-muted">&mdash;</span>
                        )}
                      </td>
                      <td
                        className={`py-2 pr-3 text-right font-mono ${
                          q.status < 300
                            ? "text-green-700"
                            : q.status < 500
                            ? "text-amber-700"
                            : "text-red-700"
                        }`}
                      >
                        {q.status}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">
                        {formatNumber(q.totalMs)}ms
                      </td>
                      <td className="py-2">
                        {q.cached ? (
                          <span className="px-1.5 py-0.5 rounded-sm bg-green-50 text-green-700 text-xs border border-green-200">
                            HIT
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-sm bg-[#F5F5F0] text-muted text-xs border border-rule-light">
                            MISS
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {queries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted">
                        No queries on this day
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          )}
        </div>
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
