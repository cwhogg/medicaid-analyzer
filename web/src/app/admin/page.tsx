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
  status: "pending" | "improved" | "queued" | "generated" | "published" | "deleted";
  createdAt: number;
  updatedAt: number;
  actions: { type: string; timestamp: number; details?: string }[];
  publishedSlug?: string;
  generatedContent?: string;
  generatedSlug?: string;
  generatedWordCount?: number;
  generatedAt?: number;
}

function simpleMarkdownToHtml(md: string): string {
  return md
    // Tables: detect header row + separator + data rows
    .replace(/^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm, (_match, header: string, _sep: string, body: string) => {
      const thCells = header.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
      const rows = body.trim().split("\n").map((row: string) => {
        const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
        return `<tr>${cells}</tr>`;
      }).join("");
      return `<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    // Headings
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Unordered lists
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Paragraphs: wrap remaining non-tag lines
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<")) return trimmed;
      return `<p>${trimmed.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");
}

function BlogIdeaPipeline({ adminKey }: { adminKey: string }) {
  const [ideas, setIdeas] = useState<BlogIdea[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState("medicaid");
  const [showDeleted, setShowDeleted] = useState(false);
  const [improvingId, setImprovingId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [ideaCount, setIdeaCount] = useState(5);
  const [ideaGuidance, setIdeaGuidance] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null);
  const [editIdeaTitle, setEditIdeaTitle] = useState("");
  const [editIdeaDesc, setEditIdeaDesc] = useState("");
  const [editIdeaQuestions, setEditIdeaQuestions] = useState<string[]>([]);
  // Published post editing state
  const [editingPostSlug, setEditingPostSlug] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState("");
  const [editPostLoading, setEditPostLoading] = useState(false);
  const [editPostSaving, setEditPostSaving] = useState(false);
  // Generate streaming state
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateEvents, setGenerateEvents] = useState<GenerationEvent[]>([]);
  const [generatePhase, setGeneratePhase] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerationEvent | null>(null);
  // Preview state for reading generated articles
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Publish state (now simple, no streaming)
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  // Collapsible log in generation progress
  const [showLog, setShowLog] = useState(false);
  // Editable title on generated posts
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const busy = generating || generatingId !== null || publishingId !== null || improvingId !== null || savingEdit;

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
  }, [generateEvents]);

  const generateIdeas = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/blog/ideas?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset: selectedDataset, count: ideaCount, guidance: ideaGuidance || undefined }),
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

  const saveDirectEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/blog/ideas/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generatedContent: editContent }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...data.idea } : i)));
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
    setEditingId(null);
    setEditContent("");
  };

  const saveTitleEdit = async (id: string) => {
    const trimmed = editTitleValue.trim();
    if (!trimmed) { setEditingTitleId(null); return; }
    setSavingEdit(true);
    try {
      const newSlug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch(`/api/blog/ideas/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, generatedSlug: newSlug }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...data.idea } : i)));
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
    setEditingTitleId(null);
    setEditTitleValue("");
  };

  const saveIdeaEdit = async (id: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/blog/ideas/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editIdeaTitle,
          description: editIdeaDesc,
          analysisQuestions: editIdeaQuestions.filter((q) => q.trim()),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...data.idea } : i)));
      }
    } catch { /* ignore */ }
    setSavingEdit(false);
    setEditingIdeaId(null);
  };

  const loadPublishedPost = async (slug: string) => {
    setEditPostLoading(true);
    setEditingPostSlug(slug);
    try {
      const res = await fetch(`/api/admin/blog?key=${encodeURIComponent(adminKey)}&slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setEditPostContent(data.content || "");
      }
    } catch { /* ignore */ }
    setEditPostLoading(false);
  };

  const savePublishedPost = async () => {
    if (!editingPostSlug) return;
    setEditPostSaving(true);
    try {
      const res = await fetch(`/api/admin/blog?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: editingPostSlug, content: editPostContent }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update word count in local state
        setBlogPosts((prev) => prev.map((p) =>
          p.slug === editingPostSlug ? { ...p, wordCount: data.wordCount } : p
        ));
        setEditingPostSlug(null);
        setEditPostContent("");
      }
    } catch { /* ignore */ }
    setEditPostSaving(false);
  };

  const queueIdea = async (id: string) => {
    try {
      const res = await fetch(`/api/blog/ideas/${id}?key=${encodeURIComponent(adminKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "queued" }),
      });
      if (res.ok) {
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status: "queued" as const } : i)));
      }
    } catch { /* ignore */ }
  };

  const generateArticle = async (id: string) => {
    setGeneratingId(id);
    setGenerateEvents([]);
    setGeneratePhase(null);
    setGenerateResult(null);
    setElapsed(0);
    setShowLog(false);

    let lastPhase: string | null = null;
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const res = await fetch(`/api/blog/ideas/${id}/generate?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        setGenerateEvents([{ phase: "error", message: data.error || `HTTP ${res.status}` }]);
        setGeneratePhase("error");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setGenerateEvents([{ phase: "error", message: "No response stream" }]);
        setGeneratePhase("error");
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
            setGenerateEvents((prev) => [...prev, event]);
            setGeneratePhase(event.phase);
            lastPhase = event.phase;
            if (event.phase === "done") setGenerateResult(event);
          } catch { /* ignore */ }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as GenerationEvent;
          setGenerateEvents((prev) => [...prev, event]);
          setGeneratePhase(event.phase);
          lastPhase = event.phase;
          if (event.phase === "done") setGenerateResult(event);
        } catch { /* ignore */ }
      }
    } catch (err) {
      lastPhase = "error";
      setGenerateEvents((prev) => [...prev, {
        phase: "error",
        message: err instanceof Error ? err.message : "Network error",
      }]);
      setGeneratePhase("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      if (lastPhase === "done") {
        // Brief delay so user can see completion state
        setTimeout(() => {
          setGeneratingId(null);
          fetchIdeas();
        }, 2500);
      } else {
        setGeneratingId(null);
        fetchIdeas();
      }
    }
  };

  const publishIdea = async (id: string) => {
    setPublishingId(id);
    try {
      const res = await fetch(`/api/blog/ideas/${id}/publish?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
      });
      if (res.ok) {
        setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status: "published" as const } : i)));
        fetchBlogPosts();
      }
    } catch { /* ignore */ }
    setPublishingId(null);
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const dsColor = (ds: string) => DATASET_OPTIONS.find((d) => d.key === ds)?.color || "#78716C";
  const dsLabel = (ds: string) => DATASET_OPTIONS.find((d) => d.key === ds)?.label || ds;

  const GENERATE_PHASE_ORDER = ["topic", "analysis", "writing", "tweeting", "done"];
  const GENERATE_PHASE_LABELS: Record<string, string> = {
    topic: "Topic",
    analysis: "Data Analysis",
    writing: "Writing Article",
    tweeting: "Tweeting",
    done: "Complete",
    error: "Error",
  };

  const getProgressPercent = (phase: string | null, events: GenerationEvent[]) => {
    let effective = phase;
    if (phase === "error") {
      const nonError = events.filter((e) => e.phase !== "error");
      effective = nonError.length > 0 ? nonError[nonError.length - 1].phase : null;
    }
    if (!effective) return 0;
    if (effective === "done") return 100;
    if (effective === "topic") return 15;
    if (effective === "analysis") {
      const steps = events.filter((e) => e.phase === "analysis" && e.step != null && e.total != null);
      if (steps.length > 0) {
        const last = steps[steps.length - 1];
        return Math.min(25 + ((last.step! / last.total!) * 35), 60);
      }
      return 25;
    }
    if (effective === "writing") return 75;
    if (effective === "tweeting") return 90;
    return 0;
  };

  const ideaIdeas = ideas.filter((i) => i.status === "pending" || i.status === "improved");
  const queuedIdeas = ideas.filter((i) => i.status === "queued");
  const generatedIdeas = ideas.filter((i) => i.status === "generated");
  const publishedIdeas = ideas.filter((i) => i.status === "published");
  const deletedIdeas = ideas.filter((i) => i.status === "deleted");

  return (
    <div className="card mb-6">
      <div className="p-4">
        {/* Top bar */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
            <div>
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
                Blog Pipeline
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Ideas &rarr; Queue &rarr; Generate &rarr; Publish
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <select
                value={ideaCount}
                onChange={(e) => setIdeaCount(Number(e.target.value))}
                className="px-2 py-1.5 text-xs border border-stone-300 rounded-sm bg-white text-stone-700"
              >
                {[1, 2, 3, 5, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "idea" : "ideas"}
                  </option>
                ))}
              </select>
              <button
                onClick={generateIdeas}
                disabled={busy}
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
          <input
            type="text"
            value={ideaGuidance}
            onChange={(e) => setIdeaGuidance(e.target.value)}
            placeholder="Focus area (optional) — e.g. &quot;state-level spending trends&quot; or &quot;rural vs urban health&quot;"
            className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-sm bg-white text-stone-700 placeholder:text-stone-400"
          />
        </div>

        {/* 1. Generated Articles */}
        {(generatedIdeas.length > 0 || generateResult) && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Generated ({generatedIdeas.length})
            </h3>
            <div className="space-y-3">
              {generatedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="bg-[#F5F5F0] rounded-sm border border-green-200 p-4"
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
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-sm bg-green-50 text-green-700 border border-green-200">
                          Generated
                        </span>
                        {idea.generatedWordCount && (
                          <span className="text-xs text-muted">
                            {idea.generatedWordCount} words
                          </span>
                        )}
                      </div>
                      {editingTitleId === idea.id ? (
                        <input
                          type="text"
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          onBlur={() => saveTitleEdit(idea.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTitleEdit(idea.id);
                            if (e.key === "Escape") { setEditingTitleId(null); setEditTitleValue(""); }
                          }}
                          autoFocus
                          className="w-full text-sm font-semibold text-foreground bg-white border border-stone-300 rounded-sm px-1.5 py-0.5 focus:outline-none focus:border-stone-500"
                        />
                      ) : (
                        <p
                          className="text-sm font-semibold text-foreground cursor-pointer hover:bg-white/60 px-1 -mx-1 rounded-sm transition-colors group"
                          onClick={() => { setEditingTitleId(idea.id); setEditTitleValue(idea.title); }}
                        >
                          {idea.title}
                          <span className="invisible group-hover:visible text-muted ml-1 text-xs font-normal">✎</span>
                        </p>
                      )}
                      {idea.generatedContent && previewId !== idea.id && (
                        <p className="text-xs text-body mt-1 line-clamp-3">
                          {idea.generatedContent.slice(0, 200)}...
                        </p>
                      )}
                      {idea.generatedAt && (
                        <p className="text-xs text-muted mt-2">
                          Generated {new Date(idea.generatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (previewId === idea.id) {
                            setPreviewId(null);
                            setEditingId(null);
                            setEditContent("");
                            setImprovingId(null);
                            setFeedbackText("");
                          } else {
                            setPreviewId(idea.id);
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        {previewId === idea.id ? "Collapse" : "Preview"}
                      </button>
                      <button
                        onClick={() => publishIdea(idea.id)}
                        disabled={busy}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                      >
                        {publishingId === idea.id ? "Publishing..." : "Publish"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded preview with edit/improve tools */}
                  {previewId === idea.id && idea.generatedContent && (
                    <div className="mt-3 pt-3 border-t border-rule-light">
                      {/* Toolbar inside preview */}
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          onClick={() => {
                            if (editingId === idea.id) {
                              setEditingId(null);
                              setEditContent("");
                            } else {
                              setImprovingId(null);
                              setFeedbackText("");
                              setEditingId(idea.id);
                              setEditContent(idea.generatedContent || "");
                            }
                          }}
                          disabled={busy && editingId !== idea.id}
                          className={`px-2.5 py-1.5 text-xs rounded-sm border transition-colors disabled:opacity-50 ${
                            editingId === idea.id
                              ? "border-stone-400 bg-stone-800 text-white"
                              : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {editingId === idea.id ? "Editing..." : "Edit Markdown"}
                        </button>
                        <button
                          onClick={() => {
                            if (improvingId === idea.id) {
                              setImprovingId(null);
                              setFeedbackText("");
                            } else {
                              setEditingId(null);
                              setEditContent("");
                              setImprovingId(idea.id);
                              setFeedbackText("");
                            }
                          }}
                          disabled={busy && improvingId !== idea.id}
                          className={`px-2.5 py-1.5 text-xs rounded-sm border transition-colors disabled:opacity-50 ${
                            improvingId === idea.id
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {improvingId === idea.id ? "Improving..." : "Improve with AI"}
                        </button>
                      </div>

                      {/* AI improve input */}
                      {improvingId === idea.id && (
                        <div className="mb-3">
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            placeholder="Instructions for article revision (e.g., 'add more context about regional differences', 'make the intro stronger')"
                            className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                            rows={2}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => improveIdea(idea.id)}
                              disabled={!feedbackText.trim()}
                              className="px-3 py-1.5 text-xs rounded-sm border border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Revise Article
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

                      {/* Direct markdown editor */}
                      {editingId === idea.id ? (
                        <div>
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground font-mono focus:outline-none focus:border-stone-500 transition-colors resize-y"
                            rows={20}
                            style={{ minHeight: "300px" }}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() => saveDirectEdit(idea.id)}
                              disabled={savingEdit || editContent === idea.generatedContent}
                              className="px-3 py-1.5 text-xs rounded-sm border border-stone-300 bg-stone-800 text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                            >
                              {savingEdit ? "Saving..." : "Save Changes"}
                            </button>
                            <button
                              onClick={() => { setEditingId(null); setEditContent(""); }}
                              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <span className="text-xs text-muted ml-auto">
                              {editContent.split(/\s+/).filter(Boolean).length} words
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Rendered preview */
                        <div className="bg-white rounded-sm border border-rule-light p-4 max-h-[400px] sm:max-h-[600px] overflow-y-auto prose prose-sm prose-stone max-w-none
                          [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-5 [&_h2]:mb-2
                          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_h3]:mb-1.5
                          [&_p]:text-sm [&_p]:text-body [&_p]:leading-relaxed [&_p]:mb-3
                          [&_table]:text-xs [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
                          [&_th]:text-left [&_th]:p-1.5 [&_th]:border [&_th]:border-rule-light [&_th]:bg-[#F5F5F0] [&_th]:font-semibold [&_th]:text-foreground
                          [&_td]:p-1.5 [&_td]:border [&_td]:border-rule-light [&_td]:text-body
                          [&_ul]:text-sm [&_ul]:text-body [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:list-disc
                          [&_ol]:text-sm [&_ol]:text-body [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal
                          [&_li]:mb-1 [&_li]:leading-relaxed
                          [&_strong]:text-foreground [&_strong]:font-semibold
                          [&_blockquote]:border-l-2 [&_blockquote]:border-rule [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted"
                          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(idea.generatedContent) }}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Queued Ideas */}
        {(queuedIdeas.length > 0 || generatingId !== null) && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Queued ({queuedIdeas.length})
            </h3>
            <div className="space-y-3">
              {queuedIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className={`bg-[#F5F5F0] rounded-sm border p-4 ${generatingId === idea.id ? "border-amber-300" : "border-amber-200"}`}
                >
                  {generatingId === idea.id ? (
                    <div className="space-y-4">
                      {/* Header: badge + status + timer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 text-xs font-medium rounded-sm"
                            style={{ backgroundColor: dsColor(idea.dataset) + "15", color: dsColor(idea.dataset) }}
                          >
                            {dsLabel(idea.dataset)}
                          </span>
                          {generatePhase === "done" ? (
                            <span className="text-sm font-medium text-green-700">Complete!</span>
                          ) : generatePhase === "error" ? (
                            <span className="text-sm font-medium text-red-700">Error</span>
                          ) : (
                            <span className="text-sm font-medium text-amber-700 animate-pulse">Generating...</span>
                          )}
                        </div>
                        <span className="text-xs text-muted font-mono">{formatElapsed(elapsed)}</span>
                      </div>

                      {/* Title */}
                      <p className="text-base font-semibold text-foreground">{idea.title}</p>

                      {/* Phase stepper */}
                      <div className="flex items-center flex-wrap gap-y-1">
                        {(() => {
                          const errorAt = generatePhase === "error"
                            ? generateEvents.filter((e) => e.phase !== "error").pop()?.phase
                            : null;
                          const PHASE_SHORT_LABELS: Record<string, string> = {
                            topic: "Topic",
                            analysis: "Analysis",
                            writing: "Writing",
                            tweeting: "Tweet",
                          };
                          return GENERATE_PHASE_ORDER.slice(0, -1).map((phase, i) => {
                            const effectivePhase = errorAt || generatePhase;
                            const phaseIdx = effectivePhase ? GENERATE_PHASE_ORDER.indexOf(effectivePhase) : -1;
                            const thisIdx = GENERATE_PHASE_ORDER.indexOf(phase);
                            const isDone = phaseIdx > thisIdx || generatePhase === "done";
                            const isActive = effectivePhase === phase && generatePhase !== "done";
                            const isError = errorAt === phase;
                            return (
                              <div key={phase} className="flex items-center">
                                <div className="flex items-center gap-1">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                    isError ? "bg-red-100 text-red-600 ring-1 ring-red-300"
                                    : isDone ? "bg-green-100 text-green-600 ring-1 ring-green-300"
                                    : isActive ? "bg-amber-100 text-amber-600 ring-1 ring-amber-300 animate-pulse"
                                    : "bg-stone-100 text-stone-400 ring-1 ring-stone-200"
                                  }`}>
                                    {isError ? "✕" : isDone ? "✓" : isActive ? "●" : "○"}
                                  </div>
                                  <span className={`text-xs font-medium whitespace-nowrap ${
                                    isError ? "text-red-600"
                                    : isDone ? "text-green-600"
                                    : isActive ? "text-amber-600"
                                    : "text-stone-400"
                                  }`}>
                                    {PHASE_SHORT_LABELS[phase] || phase}
                                  </span>
                                </div>
                                {i < GENERATE_PHASE_ORDER.length - 2 && (
                                  <div className={`w-4 sm:w-8 h-px mx-1 sm:mx-2 ${isDone ? "bg-green-300" : "bg-stone-200"}`} />
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-stone-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${
                            generatePhase === "done" ? "bg-green-500"
                            : generatePhase === "error" ? "bg-red-500"
                            : "bg-amber-500"
                          }`}
                          style={{ width: `${getProgressPercent(generatePhase, generateEvents)}%` }}
                        />
                      </div>

                      {/* Status text */}
                      {generateEvents.length > 0 && generatePhase !== "done" && generatePhase !== "error" && (
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {generateEvents[generateEvents.length - 1].message}
                          </p>
                          {generateEvents[generateEvents.length - 1].question && (
                            <p className="text-xs text-muted mt-0.5">
                              {generateEvents[generateEvents.length - 1].question}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Done banner */}
                      {generatePhase === "done" && generateResult && (
                        <div className="p-3 rounded-sm bg-green-50 border border-green-200">
                          <p className="text-sm font-medium text-green-700">
                            ✓ Article generated — {generateResult.wordCount} words in {formatElapsed(Math.round((generateResult.generationMs || 0) / 1000))}
                          </p>
                        </div>
                      )}

                      {/* Error banner */}
                      {generatePhase === "error" && (
                        <div className="p-3 rounded-sm bg-red-50 border border-red-200">
                          <p className="text-sm font-medium text-red-700">
                            {generateEvents.filter((e) => e.phase === "error").map((e) => e.message).join(". ")}
                          </p>
                        </div>
                      )}

                      {/* Collapsible log */}
                      <div>
                        <button
                          onClick={() => setShowLog(!showLog)}
                          className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1"
                        >
                          <span>{showLog ? "▾" : "▸"}</span>
                          {showLog ? "Hide log" : "Show log"}
                        </button>
                        {showLog && (
                          <div
                            ref={logRef}
                            className="mt-2 bg-white rounded-sm border border-rule-light p-2 max-h-40 overflow-y-auto font-mono text-xs space-y-0.5"
                          >
                            {generateEvents.map((ev, i) => (
                              <div key={i} className={`flex gap-2 ${ev.phase === "error" ? "text-red-700" : ev.phase === "done" ? "text-green-700" : "text-body"}`}>
                                <span className="text-muted shrink-0 w-12 text-right">{GENERATE_PHASE_LABELS[ev.phase]?.slice(0, 5) || ev.phase}</span>
                                <span>{ev.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (<>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-1.5 py-0.5 text-xs font-medium rounded-sm"
                          style={{ backgroundColor: dsColor(idea.dataset) + "15", color: dsColor(idea.dataset) }}
                        >
                          {dsLabel(idea.dataset)}
                        </span>
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-sm bg-amber-50 text-amber-700 border border-amber-200">
                          Queued
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{idea.title}</p>
                      <p className="text-xs text-body mt-1">{idea.description}</p>
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
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => {
                          if (editingIdeaId === idea.id) {
                            setEditingIdeaId(null);
                          } else {
                            setImprovingId(null);
                            setFeedbackText("");
                            setEditingIdeaId(idea.id);
                            setEditIdeaTitle(idea.title);
                            setEditIdeaDesc(idea.description);
                            setEditIdeaQuestions([...(idea.analysisQuestions || [])]);
                          }
                        }}
                        disabled={busy && editingIdeaId !== idea.id}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (improvingId === idea.id) {
                            setImprovingId(null);
                            setFeedbackText("");
                          } else {
                            setEditingIdeaId(null);
                            setImprovingId(idea.id);
                            setFeedbackText("");
                          }
                        }}
                        disabled={busy && improvingId !== idea.id}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      >
                        Improve
                      </button>
                      <button
                        onClick={() => generateArticle(idea.id)}
                        disabled={busy}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  {/* Inline edit for queued idea */}
                  {editingIdeaId === idea.id && (
                    <div className="mt-3 pt-3 border-t border-rule-light space-y-2">
                      <div>
                        <label className="text-xs font-medium text-muted block mb-0.5">Title</label>
                        <input
                          type="text"
                          value={editIdeaTitle}
                          onChange={(e) => setEditIdeaTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-rule rounded-sm text-foreground focus:outline-none focus:border-stone-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted block mb-0.5">Description</label>
                        <textarea
                          value={editIdeaDesc}
                          onChange={(e) => setEditIdeaDesc(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-rule rounded-sm text-foreground focus:outline-none focus:border-stone-500 transition-colors resize-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted block mb-0.5">Analysis Questions</label>
                        {editIdeaQuestions.map((q, qi) => (
                          <div key={qi} className="flex gap-1.5 mb-1">
                            <span className="text-xs text-muted pt-2 shrink-0">{qi + 1}.</span>
                            <textarea
                              value={q}
                              onChange={(e) => {
                                const updated = [...editIdeaQuestions];
                                updated[qi] = e.target.value;
                                setEditIdeaQuestions(updated);
                              }}
                              className="flex-1 px-2 py-1 text-xs bg-white border border-rule rounded-sm text-foreground focus:outline-none focus:border-stone-500 transition-colors resize-none"
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveIdeaEdit(idea.id)}
                          disabled={savingEdit}
                          className="px-3 py-1.5 text-xs rounded-sm border border-stone-300 bg-stone-800 text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                        >
                          {savingEdit ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={() => setEditingIdeaId(null)}
                          className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline improve for queued idea */}
                  {improvingId === idea.id && (
                    <div className="mt-3 pt-3 border-t border-rule-light">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Optional feedback for refinement (e.g., 'focus more on regional differences', 'sharpen the analysis questions')"
                        className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => improveIdea(idea.id)}
                          className="px-3 py-1.5 text-xs rounded-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
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

                  </>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Ideas (pending/improved) */}
        {ideaIdeas.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Ideas ({ideaIdeas.length})
            </h3>
            <div className="space-y-3">
              {ideaIdeas.map((idea) => (
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
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        onClick={() => deleteIdea(idea.id)}
                        disabled={busy}
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
                        disabled={busy && improvingId !== idea.id}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                        title="Improve"
                      >
                        Improve
                      </button>
                      <button
                        onClick={() => queueIdea(idea.id)}
                        disabled={busy}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        title="Queue for generation"
                      >
                        Queue
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
                        className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground placeholder:text-muted focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                        rows={2}
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => improveIdea(idea.id)}
                          className="px-3 py-1.5 text-xs rounded-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
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
                </div>
              ))}
            </div>
          </div>
        )}

        {ideaIdeas.length === 0 && queuedIdeas.length === 0 && generatedIdeas.length === 0 && !generating && generateEvents.length === 0 && (
          <p className="text-xs text-muted mb-4">
            No pending ideas. Click &ldquo;Generate Ideas&rdquo; to create a batch.
          </p>
        )}

        {/* 4. Published */}
        {(publishedIdeas.length > 0 || blogPosts.length > 0) && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Published ({blogPosts.length})
            </h3>
            <div className="space-y-1.5">
              {blogPosts.map((post) => (
                <div key={post.slug} className="bg-[#F5F5F0] rounded-sm border border-rule-light">
                  <div className="flex items-center justify-between p-2.5">
                    <div className="min-w-0">
                      <a href={`/blog/${post.slug}`} className="text-sm text-foreground hover:text-teal transition-colors block truncate">
                        {post.title}
                      </a>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(post.date).toLocaleDateString()} &middot; {post.wordCount} words
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => {
                          if (editingPostSlug === post.slug) {
                            setEditingPostSlug(null);
                            setEditPostContent("");
                          } else {
                            loadPublishedPost(post.slug);
                          }
                        }}
                        disabled={editPostSaving}
                        className="px-2.5 py-1.5 text-xs rounded-sm border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                      >
                        {editingPostSlug === post.slug ? "Close" : "Edit"}
                      </button>
                      <a href={`/blog/${post.slug}`} className="text-xs text-teal hover:underline">
                        View &rarr;
                      </a>
                    </div>
                  </div>

                  {/* Inline editor for published post */}
                  {editingPostSlug === post.slug && (
                    <div className="px-2.5 pb-2.5">
                      {editPostLoading ? (
                        <div className="text-xs text-muted py-4 text-center">Loading...</div>
                      ) : (
                        <>
                          <textarea
                            value={editPostContent}
                            onChange={(e) => setEditPostContent(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-rule rounded-sm text-foreground font-mono focus:outline-none focus:border-stone-500 transition-colors resize-y"
                            rows={20}
                            style={{ minHeight: "300px" }}
                          />
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={savePublishedPost}
                              disabled={editPostSaving}
                              className="px-3 py-1.5 text-xs rounded-sm border border-stone-300 bg-stone-800 text-white hover:bg-stone-900 transition-colors disabled:opacity-50"
                            >
                              {editPostSaving ? "Saving & Publishing..." : "Save & Republish"}
                            </button>
                            <button
                              onClick={() => { setEditingPostSlug(null); setEditPostContent(""); }}
                              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <span className="text-xs text-muted ml-auto">
                              {editPostContent.split(/\s+/).filter(Boolean).length} words
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Deleted ideas (collapsed) */}
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
    <div className="min-h-screen bg-background text-foreground px-4 py-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
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
        <div className="relative">
          <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[700px]">
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
