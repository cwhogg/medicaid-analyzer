"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

interface DaySummary {
  day: string;
  queryCount: number;
  uniqueUsers: number;
}

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

interface BlogPost {
  slug: string;
  title: string;
  date: string;
  wordCount: number;
  keywords: string[];
}

interface GenerationEvent {
  phase: string;
  message: string;
  title?: string;
  slug?: string;
  description?: string;
  wordCount?: number;
  analysisSteps?: number;
  generationMs?: number;
  step?: number;
  total?: number;
  questions?: number;
  rows?: number;
  skipped?: boolean;
  question?: string;
}

const PHASE_LABELS: Record<string, string> = {
  topic: "Topic Generation",
  analysis: "Data Analysis",
  writing: "Writing Article",
  publishing: "Publishing",
  done: "Complete",
  error: "Error",
};

const PHASE_ORDER = ["topic", "analysis", "writing", "publishing", "done"];

function BlogGenerationPanel({ adminKey }: { adminKey: string }) {
  const [generating, setGenerating] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<GenerationEvent | null>(null);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchBlogPosts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/blog?key=${encodeURIComponent(adminKey)}`
      );
      if (res.ok) {
        const data = await res.json();
        setBlogPosts(data.posts || []);
      }
    } catch {
      /* ignore */
    }
  }, [adminKey]);

  useEffect(() => {
    fetchBlogPosts();
  }, [fetchBlogPosts]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  // Focus input when prompt opens
  useEffect(() => {
    if (showPrompt && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showPrompt]);

  const generate = async (topic: string | null) => {
    setShowPrompt(false);
    setTopicInput("");
    setGenerating(true);
    setEvents([]);
    setCurrentPhase(null);
    setResult(null);
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topic ? { topic } : {}),
      };

      const res = await fetch(
        `/api/blog/generate?key=${encodeURIComponent(adminKey)}`,
        fetchOptions
      );

      if (!res.ok) {
        const data = await res.json();
        setEvents([{ phase: "error", message: data.error || `HTTP ${res.status}` }]);
        setCurrentPhase("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setEvents([{ phase: "error", message: "No response stream" }]);
        setCurrentPhase("error");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as GenerationEvent;
            setEvents((prev) => [...prev, event]);
            setCurrentPhase(event.phase);

            if (event.phase === "done") {
              setResult(event);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as GenerationEvent;
          setEvents((prev) => [...prev, event]);
          setCurrentPhase(event.phase);
          if (event.phase === "done") setResult(event);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          phase: "error",
          message: err instanceof Error ? err.message : "Network error",
        },
      ]);
      setCurrentPhase("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setGenerating(false);
      fetchBlogPosts();
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <GlassCard className="mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Blog Posts ({blogPosts.length})
            </h2>
            <p className="text-xs text-muted/60 mt-0.5">
              Generate data-driven posts from 227M claims
            </p>
          </div>
          <button
            onClick={() => setShowPrompt(true)}
            disabled={generating}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Post"
            )}
          </button>
        </div>

        {/* Topic prompt */}
        {showPrompt && !generating && (
          <div className="mb-4 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <p className="text-sm text-white mb-3">
              Enter a topic or let Claude choose one automatically.
            </p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && topicInput.trim()) {
                    generate(topicInput.trim());
                  } else if (e.key === "Escape") {
                    setShowPrompt(false);
                    setTopicInput("");
                  }
                }}
                placeholder="e.g. Telehealth spending growth since 2020"
                className="flex-1 px-3 py-2 text-sm bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder:text-muted-dark focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              {topicInput.trim() && (
                <button
                  onClick={() => generate(topicInput.trim())}
                  className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Generate
                </button>
              )}
              <button
                onClick={() => generate(null)}
                className="px-4 py-2 text-sm rounded-lg bg-white/[0.05] border border-white/[0.08] text-muted hover:text-white hover:bg-white/[0.1] transition-colors"
              >
                Let Claude Choose
              </button>
              <button
                onClick={() => {
                  setShowPrompt(false);
                  setTopicInput("");
                }}
                className="px-3 py-2 text-sm text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Generation progress */}
        {(generating || events.length > 0) && (
          <div className="mb-4">
            {/* Phase pipeline */}
            <div className="flex items-center gap-1 mb-3 overflow-x-auto">
              {PHASE_ORDER.slice(0, -1).map((phase, i) => {
                const phaseIdx = currentPhase
                  ? PHASE_ORDER.indexOf(currentPhase)
                  : -1;
                const thisIdx = PHASE_ORDER.indexOf(phase);
                const isActive = currentPhase === phase;
                const isDone =
                  phaseIdx > thisIdx ||
                  currentPhase === "done" ||
                  (currentPhase === "error" && phaseIdx > thisIdx);
                const isError = currentPhase === "error" && isActive;

                return (
                  <div key={phase} className="flex items-center gap-1">
                    <div
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        isError
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : isActive
                          ? "bg-accent/20 text-accent border border-accent/30"
                          : isDone
                          ? "bg-green-500/10 text-green-400/80 border border-green-500/20"
                          : "bg-white/[0.03] text-muted/40 border border-white/[0.05]"
                      }`}
                    >
                      {isDone && !isActive ? "\u2713 " : ""}
                      {PHASE_LABELS[phase]}
                    </div>
                    {i < PHASE_ORDER.length - 2 && (
                      <span className="text-white/20 text-xs">&rarr;</span>
                    )}
                  </div>
                );
              })}
              {generating && (
                <span className="text-xs text-muted/60 ml-2 font-mono whitespace-nowrap">
                  {formatElapsed(elapsed)}
                </span>
              )}
            </div>

            {/* Event log */}
            <div
              ref={logRef}
              className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1"
            >
              {events.map((ev, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${
                    ev.phase === "error"
                      ? "text-red-400"
                      : ev.phase === "done"
                      ? "text-green-400"
                      : "text-muted/80"
                  }`}
                >
                  <span className="text-muted/40 shrink-0 w-[3.5rem] text-right">
                    {PHASE_LABELS[ev.phase]?.slice(0, 5) || ev.phase}
                  </span>
                  <span>{ev.message}</span>
                </div>
              ))}
              {generating && events.length === 0 && (
                <div className="text-muted/40">Starting generation...</div>
              )}
            </div>

            {/* Result card */}
            {result && (
              <div className="mt-3 p-3 rounded-lg bg-green-500/[0.06] border border-green-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {result.title}
                    </p>
                    <p className="text-xs text-muted mt-1">
                      {result.wordCount} words &middot;{" "}
                      {result.analysisSteps} analyses &middot;{" "}
                      {Math.round((result.generationMs || 0) / 1000)}s
                    </p>
                    <p className="text-xs text-muted/60 mt-1">
                      Committed to GitHub. Vercel will auto-deploy in ~60s.
                    </p>
                  </div>
                  <a
                    href={`/blog/${result.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline shrink-0 mt-1"
                  >
                    View post &rarr;
                  </a>
                </div>
              </div>
            )}

            {currentPhase === "error" && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/[0.06] border border-red-500/20">
                <p className="text-xs text-red-400">
                  Generation failed. Check the log above for details.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Existing posts */}
        {blogPosts.length > 0 ? (
          <div className="space-y-2">
            {blogPosts.map((post) => (
              <div
                key={post.slug}
                className="flex items-center justify-between bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]"
              >
                <div className="min-w-0">
                  <a
                    href={`/blog/${post.slug}`}
                    className="text-sm text-white hover:text-accent transition-colors block truncate"
                  >
                    {post.title}
                  </a>
                  <p className="text-xs text-muted/60 mt-0.5">
                    {new Date(post.date).toLocaleDateString()} &middot;{" "}
                    {post.wordCount} words
                  </p>
                </div>
                <a
                  href={`/blog/${post.slug}`}
                  className="text-xs text-accent hover:underline shrink-0 ml-4"
                >
                  View &rarr;
                </a>
              </div>
            ))}
          </div>
        ) : (
          !generating &&
          events.length === 0 && (
            <p className="text-xs text-muted/40">
              No blog posts yet. Click &ldquo;Generate Post&rdquo; to create
              one.
            </p>
          )
        )}
      </div>
    </GlassCard>
  );
}

function AdminDashboard() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [dailyData, setDailyData] = useState<DaySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedSQL, setExpandedSQL] = useState<Set<number>>(new Set());

  const fetchDailyQueries = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch(`/api/admin/queries?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        setDailyData(data.days || []);
      }
    } catch {
      /* ignore — non-critical */
    }
  }, [key]);

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
    fetchDailyQueries();
    const interval = setInterval(() => {
      fetchMetrics();
      fetchDailyQueries();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, fetchDailyQueries]);

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

  const budgetColor =
    metrics.costs.budgetPercent >= 80 ? "bg-red-500" : "bg-accent";

  return (
    <div className="min-h-screen bg-background text-white p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-heading">Admin Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Tracking since{" "}
            {new Date(metrics.uptime.startTime).toLocaleDateString()} (
            {formatUptime(metrics.uptime.seconds)})
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
            <p className="text-xs text-muted uppercase tracking-wider">
              Total Requests
            </p>
            <p className="text-3xl font-bold font-mono mt-1">
              {formatNumber(metrics.traffic.totalRequests)}
            </p>
            <p className="text-xs text-muted mt-1">
              {metrics.performance.sampleSize} in rolling window
            </p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">
              Unique Users
            </p>
            <p className="text-3xl font-bold font-mono mt-1">
              {formatNumber(metrics.traffic.uniqueUsers)}
            </p>
            <p className="text-xs text-muted mt-1">by IP address</p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">
              Queries / User
            </p>
            <p className="text-3xl font-bold font-mono mt-1">
              {metrics.traffic.uniqueUsers > 0
                ? (
                    metrics.traffic.totalRequests / metrics.traffic.uniqueUsers
                  ).toFixed(1)
                : "0"}
            </p>
            <p className="text-xs text-muted mt-1">avg requests per user</p>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="p-4">
            <p className="text-xs text-muted uppercase tracking-wider">
              Est. Cost
            </p>
            <p className="text-3xl font-bold font-mono mt-1">
              <span
                className={
                  metrics.costs.budgetPercent >= 80
                    ? "text-red-400"
                    : "text-accent"
                }
              >
                ${metrics.costs.estimatedUSD.toFixed(2)}
              </span>
            </p>
            <div className="mt-2">
              <div className="w-full h-2 rounded-full bg-white/[0.05]">
                <div
                  className={`h-2 rounded-full transition-all ${budgetColor}`}
                  style={{
                    width: `${Math.min(metrics.costs.budgetPercent, 100)}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted mt-1">
                {metrics.costs.budgetPercent}% of ${metrics.costs.budgetLimit}{" "}
                limit
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Queries by Day Chart */}
      {dailyData.length > 0 && (
        <GlassCard className="mb-6">
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
              Queries by Day
            </h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...dailyData].reverse()}
                  margin={{ top: 20, right: 4, bottom: 0, left: -12 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.04)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v + "T00:00:00");
                      return d.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tick={{ fill: "#6B7280", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: 12,
                    }}
                    labelFormatter={(v: string) => {
                      const d = new Date(v + "T00:00:00");
                      return d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                    formatter={(value: number) => [value, "Queries"]}
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  />
                  <Bar
                    dataKey="queryCount"
                    fill="#EA580C"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  >
                    <LabelList
                      dataKey="queryCount"
                      position="top"
                      fill="#9CA3AF"
                      fontSize={11}
                      offset={4}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Middle Row: Routes + Response Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Requests by Route
            </h2>
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
                    <tr
                      key={route}
                      className="border-t border-white/[0.05]"
                    >
                      <td className="py-1.5 font-mono text-xs">{route}</td>
                      <td className="py-1.5 text-right font-mono">
                        {formatNumber(count)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Response Times (ms)
            </h2>
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
                  <tr
                    key={row.name}
                    className="border-t border-white/[0.05]"
                  >
                    <td className="py-1.5">{row.name}</td>
                    <td className="py-1.5 text-right font-mono">
                      {formatNumber(row.avg)}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {formatNumber(row.p95)}
                    </td>
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
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Token Usage
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Input tokens</span>
                <span className="font-mono">
                  {formatNumber(metrics.costs.inputTokens)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Output tokens</span>
                <span className="font-mono">
                  {formatNumber(metrics.costs.outputTokens)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-white/[0.05]">
                <span className="text-muted">Raw token cost</span>
                <span className="font-mono">
                  $
                  {(
                    (metrics.costs.inputTokens * 3) / 1_000_000 +
                    (metrics.costs.outputTokens * 15) / 1_000_000
                  ).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Est. actual (5x)</span>
                <span className="font-mono">
                  $
                  {(
                    ((metrics.costs.inputTokens * 3) / 1_000_000 +
                      (metrics.costs.outputTokens * 15) / 1_000_000) *
                    5
                  ).toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Rate Limiting
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Tracked IPs</span>
                <span className="font-mono">
                  {metrics.rateLimit.trackedIPs}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Limit per hour</span>
                <span className="font-mono">
                  {metrics.rateLimit.limitPerHour}
                </span>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
              Status Codes
            </h2>
            <div className="space-y-1.5 text-sm">
              {Object.entries(metrics.traffic.byStatus)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([code, count]) => (
                  <div key={code} className="flex justify-between">
                    <span
                      className={`font-mono ${
                        code.startsWith("2")
                          ? "text-green-400"
                          : code.startsWith("4")
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {code}
                    </span>
                    <span className="font-mono">{formatNumber(count)}</span>
                  </div>
                ))}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <a
          href={`/admin/users?key=${encodeURIComponent(key || "")}`}
        >
          <GlassCard className="hover:bg-white/[0.06] transition-colors cursor-pointer">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Top Users</h2>
                <p className="text-xs text-muted mt-1">
                  {formatNumber(metrics.traffic.uniqueUsers)} unique users
                </p>
              </div>
              <span className="text-accent text-lg">&rarr;</span>
            </div>
          </GlassCard>
        </a>
        <a
          href={`/admin/queries?key=${encodeURIComponent(key || "")}`}
        >
          <GlassCard className="hover:bg-white/[0.06] transition-colors cursor-pointer">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Daily Queries
                </h2>
                <p className="text-xs text-muted mt-1">
                  Per-day breakdown with drill-down
                </p>
              </div>
              <span className="text-accent text-lg">&rarr;</span>
            </div>
          </GlassCard>
        </a>
        <a
          href={`/admin/retention?key=${encodeURIComponent(key || "")}`}
        >
          <GlassCard className="hover:bg-white/[0.06] transition-colors cursor-pointer">
            <div className="p-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Retention</h2>
                <p className="text-xs text-muted mt-1">
                  Cohorts, engagement, return rates
                </p>
              </div>
              <span className="text-accent text-lg">&rarr;</span>
            </div>
          </GlassCard>
        </a>
      </div>

      {/* Blog Management */}
      {key && <BlogGenerationPanel adminKey={key} />}

      {/* Sentry Link */}
      <GlassCard className="mb-6">
        <div className="p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Error Monitoring
            </h2>
            <p className="text-xs text-muted/60 mt-1">
              View errors and performance in Sentry
            </p>
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
                <div
                  key={fb.id}
                  className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.05]"
                >
                  <p className="text-sm text-white whitespace-pre-wrap">
                    {fb.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted/60">
                    <span>
                      {new Date(fb.timestamp).toLocaleString()}
                    </span>
                    {fb.page && (
                      <span className="font-mono">{fb.page}</span>
                    )}
                    {fb.ip && (
                      <span className="font-mono">{fb.ip}</span>
                    )}
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
                  <tr
                    key={i}
                    className="border-t border-white/[0.05] align-top"
                  >
                    <td className="py-2 pr-3 text-muted whitespace-nowrap">
                      {q.ago}
                    </td>
                    <td className="py-2 pr-3 font-mono text-muted">
                      {q.route.replace("/api/", "")}
                    </td>
                    <td className="py-2 pr-3 max-w-[300px] truncate">
                      {q.question}
                    </td>
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
                {metrics.recentQueries.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted/40"
                    >
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
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
