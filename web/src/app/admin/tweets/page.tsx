"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface BlogIdea {
  id: string;
  status: string;
  data: {
    title?: string;
    slug?: string;
    generatedTweet1?: string;
    generatedTweet2?: string;
    tweetId?: string;
    tweetReplyId?: string;
    autoPublishDate?: string;
    publishedSlug?: string;
  } | null;
}

interface TweetMetric {
  id: string;
  blog_idea_id: string;
  tweet_id: string;
  slug: string;
  tweet_text: string;
  recorded_at: number;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  link_clicks: number;
  profile_clicks: number;
  engagement_score?: number;
  engagement_rate?: number;
}

interface MetricsForm {
  tweet_id: string;
  impressions: string;
  likes: string;
  retweets: string;
  replies: string;
  quotes: string;
  bookmarks: string;
  link_clicks: string;
  profile_clicks: string;
}

const emptyForm: MetricsForm = {
  tweet_id: "",
  impressions: "",
  likes: "",
  retweets: "",
  replies: "",
  quotes: "",
  bookmarks: "",
  link_clicks: "",
  profile_clicks: "",
};

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + "..." : s;
}

// Parse CSV text into array of objects, handling quoted fields
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Parse a single CSV line respecting quoted fields
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length < 2) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] || "";
    });
    rows.push(row);
  }
  return rows;
}

interface CSVPreviewRow {
  tweet_id: string;
  tweet_text: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  link_clicks: number;
  profile_clicks: number;
  matched_idea_id?: string;
  matched_title?: string;
}

// Map X analytics CSV columns to our schema
// X CSV columns: "Tweet id", "Tweet text", "impressions", "engagements", "engagement rate",
// "retweets", "replies", "likes", "user profile clicks", "url clicks", "hashtag clicks",
// "detail expands", "permalink clicks", "media views", "media engagements", "bookmarks"
function mapCSVRow(row: Record<string, string>): Omit<CSVPreviewRow, "matched_idea_id" | "matched_title"> {
  // Normalize header lookup (case-insensitive, trim whitespace)
  const get = (keys: string[]): string => {
    for (const k of keys) {
      for (const [header, val] of Object.entries(row)) {
        if (header.toLowerCase().trim() === k.toLowerCase()) return val;
      }
    }
    return "";
  };

  return {
    tweet_id: get(["Tweet id", "tweet id", "Tweet ID", "id"]),
    tweet_text: get(["Tweet text", "tweet text", "Tweet Text", "text"]).slice(0, 500),
    impressions: parseInt(get(["impressions", "Impressions"])) || 0,
    likes: parseInt(get(["likes", "Likes"])) || 0,
    retweets: parseInt(get(["retweets", "Retweets"])) || 0,
    replies: parseInt(get(["replies", "Replies"])) || 0,
    bookmarks: parseInt(get(["bookmarks", "Bookmarks"])) || 0,
    link_clicks: parseInt(get(["url clicks", "URL clicks", "Url clicks", "link clicks", "link_clicks", "permalink clicks"])) || 0,
    profile_clicks: parseInt(get(["user profile clicks", "User profile clicks", "profile clicks", "profile_clicks"])) || 0,
  };
}

function TweetsPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");

  const [ideas, setIdeas] = useState<BlogIdea[]>([]);
  const [topTweets, setTopTweets] = useState<TweetMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, MetricsForm>>({});
  const [tab, setTab] = useState<"entry" | "upload" | "dashboard">("entry");
  const [csvPreview, setCsvPreview] = useState<CSVPreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    try {
      const [ideasRes, metricsRes, topRes] = await Promise.all([
        fetch(`/api/blog/ideas?key=${encodeURIComponent(key)}`),
        fetch(`/api/admin/tweets?key=${encodeURIComponent(key)}`),
        fetch(`/api/admin/tweets?key=${encodeURIComponent(key)}&top=1`),
      ]);

      if (ideasRes.status === 401 || metricsRes.status === 404) {
        setError("not_found");
        return;
      }

      const ideasData = ideasRes.ok ? await ideasRes.json() : { ideas: [] };
      const metricsData = metricsRes.ok ? await metricsRes.json() : { metrics: [] };
      const topData = topRes.ok ? await topRes.json() : { tweets: [] };

      // Railway returns ideas as { id, status, data: {...} }
      const published = (ideasData.ideas || [])
        .filter((idea: { status: string; data: BlogIdea["data"] }) => idea.status === "published" && idea.data)
        .map((idea: { id: string; status: string; data: BlogIdea["data"] }) => ({
          id: idea.id,
          status: idea.status,
          data: idea.data,
        }));
      setIdeas(published);
      const allMetrics: TweetMetric[] = metricsData.metrics || [];
      setTopTweets(topData.tweets || []);

      // Pre-fill forms from existing metrics
      const metricsById: Record<string, TweetMetric> = {};
      for (const m of allMetrics) {
        metricsById[m.blog_idea_id] = m;
      }

      const initialForms: Record<string, MetricsForm> = {};
      for (const idea of published) {
        const existing = metricsById[idea.id];
        if (existing) {
          initialForms[idea.id] = {
            tweet_id: existing.tweet_id || idea.data?.tweetId || "",
            impressions: String(existing.impressions || ""),
            likes: String(existing.likes || ""),
            retweets: String(existing.retweets || ""),
            replies: String(existing.replies || ""),
            quotes: String(existing.quotes || ""),
            bookmarks: String(existing.bookmarks || ""),
            link_clicks: String(existing.link_clicks || ""),
            profile_clicks: String(existing.profile_clicks || ""),
          };
        } else {
          initialForms[idea.id] = {
            ...emptyForm,
            tweet_id: idea.data?.tweetId || "",
          };
        }
      }
      setForms(initialForms);
      setError(null);
    } catch {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFormChange = (ideaId: string, field: keyof MetricsForm, value: string) => {
    setForms((prev) => ({
      ...prev,
      [ideaId]: { ...(prev[ideaId] || emptyForm), [field]: value },
    }));
  };

  const handleSave = async (idea: BlogIdea) => {
    if (!key) return;
    const form = forms[idea.id];
    if (!form) return;

    setSaving(idea.id);
    try {
      const body = {
        id: idea.id,
        blog_idea_id: idea.id,
        tweet_id: form.tweet_id || undefined,
        slug: idea.data?.publishedSlug || idea.data?.slug || "",
        tweet_text: idea.data?.generatedTweet1 || "",
        impressions: parseInt(form.impressions) || 0,
        likes: parseInt(form.likes) || 0,
        retweets: parseInt(form.retweets) || 0,
        replies: parseInt(form.replies) || 0,
        quotes: parseInt(form.quotes) || 0,
        bookmarks: parseInt(form.bookmarks) || 0,
        link_clicks: parseInt(form.link_clicks) || 0,
        profile_clicks: parseInt(form.profile_clicks) || 0,
      };

      const res = await fetch(`/api/admin/tweets?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Save failed: ${(err as { error?: string }).error || "Unknown error"}`);
      } else {
        // Refresh top tweets
        const topRes = await fetch(`/api/admin/tweets?key=${encodeURIComponent(key)}&top=1`);
        if (topRes.ok) {
          const topData = await topRes.json();
          setTopTweets(topData.tweets || []);
        }
      }
    } catch {
      alert("Save failed");
    } finally {
      setSaving(null);
    }
  };

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setUploadResult("No data rows found in CSV");
        return;
      }

      // Build tweet ID -> idea lookup from loaded ideas
      const tweetIdToIdea: Record<string, BlogIdea> = {};
      for (const idea of ideas) {
        const tid = idea.data?.tweetId;
        if (tid) tweetIdToIdea[tid] = idea;
      }

      const preview: CSVPreviewRow[] = rows.map((row) => {
        const mapped = mapCSVRow(row);
        const matchedIdea = tweetIdToIdea[mapped.tweet_id];
        return {
          ...mapped,
          matched_idea_id: matchedIdea?.id,
          matched_title: matchedIdea?.data?.title,
        };
      });

      // Filter to rows with at least impressions > 0
      const valid = preview.filter((r) => r.tweet_id && r.impressions > 0);
      setCsvPreview(valid.length > 0 ? valid : preview.filter((r) => r.tweet_id));
      setUploadResult(`Parsed ${rows.length} rows, ${valid.length} with impressions data`);
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (!key || csvPreview.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const metrics = csvPreview.map((row) => ({
        id: row.matched_idea_id || `tw_${row.tweet_id}`,
        blog_idea_id: row.matched_idea_id || undefined,
        tweet_id: row.tweet_id,
        tweet_text: row.tweet_text,
        impressions: row.impressions,
        likes: row.likes,
        retweets: row.retweets,
        replies: row.replies,
        bookmarks: row.bookmarks,
        link_clicks: row.link_clicks,
        profile_clicks: row.profile_clicks,
      }));

      const res = await fetch(`/api/admin/tweets?key=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setUploadResult(`Upload failed: ${(err as { error?: string }).error || "Unknown error"}`);
      } else {
        const data = await res.json();
        setUploadResult(`Saved ${data.saved || metrics.length} tweet metrics`);
        setCsvPreview([]);
        // Refresh dashboard data
        fetchData();
      }
    } catch {
      setUploadResult("Upload failed");
    } finally {
      setUploading(false);
    }
  };

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
        <div className="animate-pulse text-muted">Loading tweets...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-teal hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-headline font-bold">Tweet Performance</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("entry")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "entry"
              ? "bg-accent text-white"
              : "bg-white/[0.05] text-muted hover:text-foreground"
          }`}
        >
          Enter Metrics ({ideas.length})
        </button>
        <button
          onClick={() => setTab("upload")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "upload"
              ? "bg-accent text-white"
              : "bg-white/[0.05] text-muted hover:text-foreground"
          }`}
        >
          Upload CSV
        </button>
        <button
          onClick={() => setTab("dashboard")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "dashboard"
              ? "bg-accent text-white"
              : "bg-white/[0.05] text-muted hover:text-foreground"
          }`}
        >
          Performance ({topTweets.length})
        </button>
      </div>

      {/* Metrics Entry */}
      {tab === "entry" && (
        <div className="space-y-4">
          {ideas.length === 0 && (
            <div className="card p-8 text-center text-muted">
              No published posts with tweets found
            </div>
          )}
          {ideas.map((idea) => {
            const form = forms[idea.id] || emptyForm;
            const tweetText = idea.data?.generatedTweet1 || "";
            const tweetId = form.tweet_id || idea.data?.tweetId || "";

            return (
              <div key={idea.id} className="card p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Post info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {idea.data?.title || idea.id}
                    </h3>
                    {idea.data?.autoPublishDate && (
                      <p className="text-xs text-muted mt-0.5">
                        {idea.data.autoPublishDate}
                      </p>
                    )}
                    {tweetText && (
                      <p className="text-xs text-muted mt-1 italic">
                        &ldquo;{truncate(tweetText, 140)}&rdquo;
                      </p>
                    )}
                    {tweetId && (
                      <a
                        href={`https://x.com/i/web/status/${tweetId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline mt-1 inline-block"
                      >
                        View on X &rarr;
                      </a>
                    )}
                  </div>

                  {/* Metrics inputs */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                    <div>
                      <label className="text-muted block mb-0.5">Tweet ID</label>
                      <input
                        type="text"
                        value={form.tweet_id}
                        onChange={(e) => handleFormChange(idea.id, "tweet_id", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="ID"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Impressions</label>
                      <input
                        type="number"
                        value={form.impressions}
                        onChange={(e) => handleFormChange(idea.id, "impressions", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Likes</label>
                      <input
                        type="number"
                        value={form.likes}
                        onChange={(e) => handleFormChange(idea.id, "likes", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">RTs</label>
                      <input
                        type="number"
                        value={form.retweets}
                        onChange={(e) => handleFormChange(idea.id, "retweets", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Replies</label>
                      <input
                        type="number"
                        value={form.replies}
                        onChange={(e) => handleFormChange(idea.id, "replies", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Quotes</label>
                      <input
                        type="number"
                        value={form.quotes}
                        onChange={(e) => handleFormChange(idea.id, "quotes", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Bookmarks</label>
                      <input
                        type="number"
                        value={form.bookmarks}
                        onChange={(e) => handleFormChange(idea.id, "bookmarks", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Link Clicks</label>
                      <input
                        type="number"
                        value={form.link_clicks}
                        onChange={(e) => handleFormChange(idea.id, "link_clicks", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-muted block mb-0.5">Profile Clicks</label>
                      <input
                        type="number"
                        value={form.profile_clicks}
                        onChange={(e) => handleFormChange(idea.id, "profile_clicks", e.target.value)}
                        className="w-full bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-foreground font-mono text-xs"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={() => handleSave(idea)}
                    disabled={saving === idea.id}
                    className="px-3 py-1.5 bg-accent text-white rounded text-xs font-medium hover:bg-accent/80 disabled:opacity-50 self-end sm:self-center whitespace-nowrap"
                  >
                    {saving === idea.id ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CSV Upload */}
      {tab === "upload" && (
        <div className="space-y-4">
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-2">
              Upload X Analytics CSV
            </h2>
            <p className="text-xs text-muted mb-4">
              Export from{" "}
              <a
                href="https://analytics.x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                analytics.x.com
              </a>
              {" "}&#8594; Tweets &#8594; Export data. The CSV should have columns like
              &ldquo;Tweet id&rdquo;, &ldquo;impressions&rdquo;, &ldquo;likes&rdquo;, etc.
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCSVFile}
              className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white hover:file:bg-accent/80 file:cursor-pointer"
            />

            {uploadResult && (
              <p className={`text-xs mt-3 ${uploadResult.includes("failed") ? "text-red-400" : "text-green-400"}`}>
                {uploadResult}
              </p>
            )}
          </div>

          {/* CSV Preview */}
          {csvPreview.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Preview ({csvPreview.length} tweets)
                </h3>
                <button
                  onClick={handleBulkUpload}
                  disabled={uploading}
                  className="px-4 py-2 bg-accent text-white rounded text-sm font-medium hover:bg-accent/80 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : `Save ${csvPreview.length} tweets`}
                </button>
              </div>

              <div className="relative">
                <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[800px]">
                    <thead>
                      <tr className="text-left text-muted">
                        <th className="pb-2 pr-3">Tweet</th>
                        <th className="pb-2 pr-3">Matched Post</th>
                        <th className="pb-2 pr-3 text-right">Impr.</th>
                        <th className="pb-2 pr-3 text-right">Likes</th>
                        <th className="pb-2 pr-3 text-right">RTs</th>
                        <th className="pb-2 pr-3 text-right">Replies</th>
                        <th className="pb-2 pr-3 text-right">Clicks</th>
                        <th className="pb-2 text-right">Bookmarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="border-t border-rule-light">
                          <td className="py-2 pr-3 text-xs max-w-[250px]">
                            <span className="block truncate" title={row.tweet_text}>
                              {truncate(row.tweet_text, 60)}
                            </span>
                            <span className="text-[10px] text-muted font-mono">
                              {row.tweet_id}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-xs">
                            {row.matched_title ? (
                              <span className="text-green-400">{truncate(row.matched_title, 40)}</span>
                            ) : (
                              <span className="text-muted">no match</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {formatNumber(row.impressions)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {formatNumber(row.likes)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {formatNumber(row.retweets)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {formatNumber(row.replies)}
                          </td>
                          <td className="py-2 pr-3 text-right font-mono text-xs">
                            {formatNumber(row.link_clicks)}
                          </td>
                          <td className="py-2 text-right font-mono text-xs">
                            {formatNumber(row.bookmarks)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Performance Dashboard */}
      {tab === "dashboard" && (
        <div className="card p-4">
          {topTweets.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">
              No tweet metrics recorded yet. Enter metrics in the &ldquo;Enter Metrics&rdquo; tab.
            </p>
          ) : (
            <div className="relative">
              <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="pb-2 pr-3">#</th>
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Tweet</th>
                      <th className="pb-2 pr-3 text-right">Impressions</th>
                      <th className="pb-2 pr-3 text-right">Likes</th>
                      <th className="pb-2 pr-3 text-right">RTs</th>
                      <th className="pb-2 pr-3 text-right">Link Clicks</th>
                      <th className="pb-2 pr-3 text-right">Eng. Rate</th>
                      <th className="pb-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topTweets.map((t, i) => (
                      <tr key={t.id} className="border-t border-rule-light">
                        <td className="py-2 pr-3 text-muted font-mono text-xs">{i + 1}</td>
                        <td className="py-2 pr-3 text-xs text-muted whitespace-nowrap">
                          {formatDate(t.recorded_at)}
                        </td>
                        <td className="py-2 pr-3 text-xs max-w-[300px]">
                          <span className="block truncate" title={t.tweet_text}>
                            {truncate(t.tweet_text || "", 80)}
                          </span>
                          {t.tweet_id && (
                            <a
                              href={`https://x.com/i/web/status/${t.tweet_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline text-[10px]"
                            >
                              view
                            </a>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          {formatNumber(t.impressions)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          {formatNumber(t.likes)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          {formatNumber(t.retweets)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          {formatNumber(t.link_clicks)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-xs">
                          {t.engagement_rate != null ? `${t.engagement_rate}%` : "-"}
                        </td>
                        <td className="py-2 text-right font-mono text-xs font-semibold text-accent">
                          {t.engagement_score != null ? Math.round(t.engagement_score) : "-"}
                        </td>
                      </tr>
                    ))}
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

export default function AdminTweetsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <TweetsPage />
    </Suspense>
  );
}
