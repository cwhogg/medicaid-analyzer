"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

interface DaySummary {
  day: string;
  queryCount: number;
  uniqueUsers: number;
  medicaid: number;
  brfss: number;
  medicare: number;
  nhanes: number;
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

const DATASET_OPTIONS = [
  { key: "medicaid", label: "Medicaid", color: "#B91C1C" },
  { key: "medicare", label: "Medicare", color: "#0F766E" },
  { key: "brfss", label: "BRFSS", color: "#1D4ED8" },
  { key: "nhanes", label: "NHANES", color: "#7C3AED" },
];

interface BlogIdea {
  id: string;
  title: string;
  description: string;
  dataset: string;
  targetKeywords: string[];
  contentGap: string;
  analysisQuestions: string[];
  status: "pending" | "improved" | "published" | "deleted";
  createdAt: number;
  updatedAt: number;
  actions: { type: string; timestamp: number; details?: string }[];
  publishedSlug?: string;
}

function BlogIdeaPipeline({ adminKey }: { adminKey: string }) {
  const [ideas, setIdeas] = useState<BlogIdea[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState("medicaid");
  const [showDeleted, setShowDeleted] = useState(false);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishEvents, setPublishEvents] = useState<GenerationEvent[]>([]);
  const [publishPhase, setPublishPhase] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<GenerationEvent | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch(`/api/blog/ideas?key=${encodeURIComponent(adminKey)}`);
      if (res.ok) {
        const data = await res.json();
        setIdeas((data.ideas || []).map((i: { data: BlogIdea }) => i.data || i));
      }
    } catch { /* ignore */ }
  }, [adminKey]);

  const fetchBlogPosts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/blog?key=${encodeURIComponent(adminKey)}`);
      if (res.ok) {
        const data = await res.json();
        setBlogPosts(data.posts || []);
      }
    } catch { /* ignore */ }
  }, [adminKey]);

  useEffect(() => {
    fetchIdeas();
    fetchBlogPosts();
  }, [fetchIdeas, fetchBlogPosts]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [publishEvents]);

  const generateIdeas = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/blog/ideas?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: selectedDataset }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => [...(data.ideas || []), ...prev]);
      }
    } catch { /* ignore */ }
    setGenerating(false);
  };

  const deleteIdea = async (id: string) => {
    try {
      await fetch(`/api/blog/ideas/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "DELETE",
      });
      setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status: "deleted" as const } : i)));
    } catch { /* ignore */ }
  };

  const improveIdea = async (id: string) => {
    setImprovingId(id);
    try {
      const res = await fetch(`/api/blog/ideas/${id}/improve?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackText || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === id ? data.idea : i)));
      }
    } catch { /* ignore */ }
    setImprovingId(null);
    setFeedbackText("");
  };

  const publishIdea = async (id: string) => {
    setPublishingId(id);
    setPublishEvents([]);
    setPublishPhase(null);
    setPublishResult(null);
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const res = await fetch(`/api/blog/ideas/${id}/publish?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        setPublishEvents([{ phase: "error", message: data.error || `HTTP ${res.status}` }]);
        setPublishPhase("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setPublishEvents([{ phase: "error", message: "No response stream" }]);
        setPublishPhase("error");
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
            setPublishEvents((prev) => [...prev, event]);
            setPublishPhase(event.phase);
            if (event.phase === "done") setPublishResult(event);
          } catch { /* ignore */ }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as GenerationEvent;
          setPublishEvents((prev) => [...prev, event]);
          setPublishPhase(event.phase);
          if (event.phase === "done") setPublishResult(event);
        } catch { /* ignore */ }
      }
    } catch (err) {
      setPublishEvents((prev) => [...prev, {
        phase: "error",
        message: err instanceof Error ? err.message : "Network error",
      }]);
      setPublishPhase("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setPublishingId(null);
      fetchIdeas();
      fetchBlogPosts();
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const dsColor = (ds: string) => DATASET_OPTIONS.find((d) => d.key === ds)?.color || "#78716C";
  const dsLabel = (ds: string) => DATASET_OPTIONS.find((d) => d.key === ds)?.label || ds;

  const pendingIdeas = ideas.filter((i) => i.status === "pending" || i.status === "improved");
  const publishedIdeas = ideas.filter((i) => i.status === "published");
  const deletedIdeas = ideas.filter((i) => i.status === "deleted");

  return (
    <div className="card mb-6">
      <div className="p-4">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              Blog Pipeline
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Generate ideas, curate, then publish
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Dataset pills */}
            <div className="flex gap-1">
              {DATASET_OPTIONS.map((ds) => (
                <button
                  key={ds.key}
                  onClick={() => setSelectedDataset(ds.key)}
                  className="px-2 py-1 text-xs font-medium rounded-sm border transition-colors"
                  style={
                    selectedDataset === ds.key
                      ? { backgroundColor: ds.color + "15", borderColor: ds.color, color: ds.color }
                      : { backgroundColor: "white", borderColor: "#D6D3D1", color: "#78716C" }
                  }
                >
                  {ds.label}
                </button>
              ))}
            </div>
            <button
              onClick={generateIdeas}
              disabled={generating || publishingId !== null}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Ideas"
              )}
            </button>
          </div>
        </div>

        {/* Pending/Improved Ideas */}
        {pendingIdeas.length > 0 && (
          <div className="space-y-3 mb-4">
            {pendingIdeas.map((idea) => (
              <div
                key={idea.id}
                className="bg-[#F5F5F0] rounded-sm border border-rule-light p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="px-1.5 py-0.5 text-xs font-medium rounded-sm"
                        style={{ backgroundColor: dsColor(idea.dataset) + "15", color: dsColor(idea.dataset) }}
                      >
                        {dsLabel(idea.dataset)}
                      </span>
                      {idea.status === "improved" && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-sm bg-teal-50 text-teal-700 border border-teal-200">
                          Improved
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                    <p className="text-xs text-body mt-1">{idea.description}</p>
                    {idea.targetKeywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {idea.targetKeywords.map((kw, ki) => (
                          <span key={ki} className="px-1.5 py-0.5 text-xs bg-white border border-rule-light rounded-sm text-muted">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {idea.analysisQuestions?.length > 0 && (
                      <ol className="mt-2 space-y-0.5">
                        {idea.analysisQuestions.map((q, qi) => (
                          <li key={qi} className="text-xs text-body pl-4 relative">
                            <span className="absolute left-0 text-muted">{qi + 1}.</span>
                            {q}
                          </li>
                        ))}
                      </ol>
                    )}
                    <p className="text-xs text-muted mt-2">
                      Created {new Date(idea.createdAt).toLocaleDateString()}
                      {idea.actions?.length > 1 && ` \u00B7 ${idea.actions.length} actions`}
                    </p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => deleteIdea(idea.id)}
                      disabled={publishingId !== null}
                      className="px-2.5 py-1.5 text-xs rounded-sm border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        if (improvingId === idea.id) {
                          setImprovingId(null);
                          setFeedbackText("");
                        } else {
                          setImprovingId(idea.id);
                          setFeedbackText("");
                        }
                      }}
                      disabled={publishingId !== null || (improvingId !== null && improvingId !== idea.id)}
                      className="px-2.5 py-1.5 text-xs rounded-sm border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
                      title="Improve"
                    >
                      Improve
                    </button>
                    <button
                      onClick={() => publishIdea(idea.id)}
                      disabled={publishingId !== null || generating}
                      className="px-2.5 py-1.5 text-xs rounded-sm border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                      title="Publish"
                    >
                      Publish
                    </button>
                  </div>
                </div>

                {/* Inline improve feedback */}
                {improvingId === idea.id && (
                  <div className="mt-3 pt-3 border-t border-rule-light">
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Optional feedback for refinement (e.g., 'focus more on regional differences')"
                      className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground placeholder:text-muted focus:outline-none focus:border-teal-500 transition-colors resize-none"
                      rows={2}
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => improveIdea(idea.id)}
                        className="px-3 py-1.5 text-xs rounded-sm bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                      >
                        Refine
                      </button>
                      <button
                        onClick={() => { setImprovingId(null); setFeedbackText(""); }}
                        className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Publishing progress (shown below the card being published) */}
                {publishingId === idea.id && publishEvents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-rule-light">
                    {/* Phase pipeline */}
                    <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                      {PHASE_ORDER.slice(0, -1).map((phase, i) => {
                        const phaseIdx = publishPhase ? PHASE_ORDER.indexOf(publishPhase) : -1;
                        const thisIdx = PHASE_ORDER.indexOf(phase);
                        const isActive = publishPhase === phase;
                        const isDone = phaseIdx > thisIdx || publishPhase === "done" || (publishPhase === "error" && phaseIdx > thisIdx);
                        const isError = publishPhase === "error" && isActive;

                        return (
                          <div key={phase} className="flex items-center gap-1">
                            <div className={`px-2 py-0.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors ${
                              isError ? "bg-red-50 text-red-700 border border-red-200"
                              : isActive ? "bg-red-50 text-accent border border-red-200"
                              : isDone ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-white text-muted border border-rule-light"
                            }`}>
                              {isDone && !isActive ? "\u2713 " : ""}{PHASE_LABELS[phase]}
                            </div>
                            {i < PHASE_ORDER.length - 2 && <span className="text-rule text-xs">&rarr;</span>}
                          </div>
                        );
                      })}
                      <span className="text-xs text-muted ml-2 font-mono">{formatElapsed(elapsed)}</span>
                    </div>
                    <div
                      ref={logRef}
                      className="bg-white rounded-sm border border-rule-light p-2 max-h-32 overflow-y-auto font-mono text-xs space-y-0.5"
                    >
                      {publishEvents.map((ev, i) => (
                        <div key={i} className={`flex gap-2 ${ev.phase === "error" ? "text-red-700" : ev.phase === "done" ? "text-green-700" : "text-body"}`}>
                          <span className="text-muted shrink-0 w-12 text-right">{PHASE_LABELS[ev.phase]?.slice(0, 5) || ev.phase}</span>
                          <span>{ev.message}</span>
                        </div>
                      ))}
                    </div>
                    {publishResult && (
                      <div className="mt-2 p-2 rounded-sm bg-green-50 border border-green-200 flex items-center justify-between">
                        <p className="text-xs text-green-700">
                          Published! {publishResult.wordCount} words &middot; {Math.round((publishResult.generationMs || 0) / 1000)}s
                        </p>
                        <a href={`/blog/${publishResult.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-teal hover:underline">
                          View post &rarr;
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {pendingIdeas.length === 0 && !generating && publishEvents.length === 0 && (
          <p className="text-xs text-muted mb-4">
            No pending ideas. Click &ldquo;Generate Ideas&rdquo; to create a batch.
          </p>
        )}

        {/* Published ideas */}
        {(publishedIdeas.length > 0 || blogPosts.length > 0) && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Published ({blogPosts.length})
            </h3>
            <div className="space-y-1.5">
              {blogPosts.map((post) => (
                <div key={post.slug} className="flex items-center justify-between bg-[#F5F5F0] rounded-sm p-2.5 border border-rule-light">
                  <div className="min-w-0">
                    <a href={`/blog/${post.slug}`} className="text-sm text-foreground hover:text-teal transition-colors block truncate">
                      {post.title}
                    </a>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(post.date).toLocaleDateString()} &middot; {post.wordCount} words
                    </p>
                  </div>
                  <a href={`/blog/${post.slug}`} className="text-xs text-teal hover:underline shrink-0 ml-4">
                    View &rarr;
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deleted ideas (collapsed) */}
        {deletedIdeas.length > 0 && (
          <div>
            <button
              onClick={() => setShowDeleted(!showDeleted)}
              className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
            >
              <span className="font-mono">{showDeleted ? "\u25BC" : "\u25B6"}</span>
              Deleted ({deletedIdeas.length})
            </button>
            {showDeleted && (
              <div className="mt-2 space-y-1.5">
                {deletedIdeas.map((idea) => (
                  <div key={idea.id} className="bg-[#F5F5F0] rounded-sm p-2.5 border border-rule-light opacity-60">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-1.5 py-0.5 text-xs font-medium rounded-sm"
                        style={{ backgroundColor: dsColor(idea.dataset) + "15", color: dsColor(idea.dataset) }}
                      >
                        {dsLabel(idea.dataset)}
                      </span>
                      <span className="text-sm text-muted line-through">{idea.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
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
        <p className="text-red-700">{error}</p>
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
    metrics.costs.budgetPercent >= 80 ? "bg-red-600" : "bg-accent";

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-headline font-bold">Admin Dashboard</h1>
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
            className="px-3 py-1.5 text-sm rounded-sm bg-surface border border-rule hover:bg-[#F5F5F0] transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
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
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-wider">
            Unique Users
          </p>
          <p className="text-3xl font-bold font-mono mt-1">
            {formatNumber(metrics.traffic.uniqueUsers)}
          </p>
          <p className="text-xs text-muted mt-1">by IP address</p>
        </div>
        <div className="card p-4">
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
        <div className="card p-4">
          <p className="text-xs text-muted uppercase tracking-wider">
            Est. Cost
          </p>
          <p className="text-3xl font-bold font-mono mt-1">
            <span
              className={
                metrics.costs.budgetPercent >= 80
                  ? "text-red-700"
                  : "text-accent"
              }
            >
              ${metrics.costs.estimatedUSD.toFixed(2)}
            </span>
          </p>
          <div className="mt-2">
            <div className="w-full h-2 rounded-full bg-rule-light">
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
      </div>

      {/* Queries by Day Chart */}
      {dailyData.length > 0 && (
        <div className="card mb-6 p-4">
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
                  stroke="#E7E5E4"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#78716C", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "#D6D3D1" }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v + "T00:00:00");
                    return d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <YAxis
                  tick={{ fill: "#78716C", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D6D3D1",
                    borderRadius: "2px",
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
                  cursor={{ fill: "rgba(28,25,23,0.03)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: "#78716C" }}
                  iconType="square"
                  iconSize={10}
                />
                <Bar
                  dataKey="medicaid"
                  name="Medicaid"
                  stackId="queries"
                  fill="#B91C1C"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="medicare"
                  name="Medicare"
                  stackId="queries"
                  fill="#0F766E"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="brfss"
                  name="BRFSS"
                  stackId="queries"
                  fill="#1D4ED8"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="nhanes"
                  name="NHANES"
                  stackId="queries"
                  fill="#7C3AED"
                  radius={[2, 2, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Middle Row: Routes + Response Times */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Requests by Route
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
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
                    className="border-t border-rule-light"
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

        <div className="card p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            Response Times (ms)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
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
                  className="border-t border-rule-light"
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
      </div>

      {/* Third Row: Cost Details + Rate Limit + Status Codes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
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
            <div className="flex justify-between pt-2 border-t border-rule-light">
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

        <div className="card p-4">
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

        <div className="card p-4">
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
                        ? "text-green-700"
                        : code.startsWith("4")
                        ? "text-amber-700"
                        : "text-red-700"
                    }`}
                  >
                    {code}
                  </span>
                  <span className="font-mono">{formatNumber(count)}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <a
          href={`/admin/users?key=${encodeURIComponent(key || "")}`}
        >
          <div className="card-hover p-4 flex items-center justify-between cursor-pointer">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Top Users</h2>
              <p className="text-xs text-muted mt-1">
                {formatNumber(metrics.traffic.uniqueUsers)} unique users
              </p>
            </div>
            <span className="text-accent text-lg">&rarr;</span>
          </div>
        </a>
        <a
          href={`/admin/queries?key=${encodeURIComponent(key || "")}`}
        >
          <div className="card-hover p-4 flex items-center justify-between cursor-pointer">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Daily Queries
              </h2>
              <p className="text-xs text-muted mt-1">
                Per-day breakdown with drill-down
              </p>
            </div>
            <span className="text-accent text-lg">&rarr;</span>
          </div>
        </a>
        <a
          href={`/admin/retention?key=${encodeURIComponent(key || "")}`}
        >
          <div className="card-hover p-4 flex items-center justify-between cursor-pointer">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Retention</h2>
              <p className="text-xs text-muted mt-1">
                Cohorts, engagement, return rates
              </p>
            </div>
            <span className="text-accent text-lg">&rarr;</span>
          </div>
        </a>
      </div>

      {/* Blog Pipeline */}
      {key && <BlogIdeaPipeline adminKey={key} />}

      {/* Sentry Link */}
      <div className="card mb-6 p-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
            Error Monitoring
          </h2>
          <p className="text-xs text-muted mt-1">
            View errors and performance in Sentry
          </p>
        </div>
        <a
          href="https://woggner-llc.sentry.io/projects/medicaid-analyzer/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-sm rounded-sm bg-red-50 text-accent border border-red-200 hover:bg-red-100 transition-colors"
        >
          Open Sentry &rarr;
        </a>
      </div>

      {/* Feedback */}
      {metrics.feedback && metrics.feedback.length > 0 && (
        <div className="card mb-6 p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
            User Feedback ({metrics.feedback.length})
          </h2>
          <div className="space-y-3">
            {metrics.feedback.map((fb) => (
              <div
                key={fb.id}
                className="bg-[#F5F5F0] rounded-sm p-3 border border-rule-light"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {fb.message}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted">
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
      )}

      {/* Recent Queries */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Recent Queries ({metrics.recentQueries.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted">
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
                  className="border-t border-rule-light align-top"
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
              {metrics.recentQueries.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-8 text-center text-muted"
                  >
                    No queries recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
