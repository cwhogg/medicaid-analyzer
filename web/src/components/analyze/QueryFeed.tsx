"use client";

import { useEffect, useState } from "react";
import { Clock, ChevronRight, Database, Layers, Search } from "lucide-react";
import { getAllQueries, getAllAnalyses, type StoredQuery, type StoredAnalysis } from "@/lib/queryStore";

interface ServerFeedItem {
  id: string;
  question: string;
  route: string;
  timestamp: number;
  summary: string | null;
  stepCount: number;
  rowCount: number;
}

type FeedItem =
  | (StoredQuery & { _type: "query"; _source: "local" })
  | (StoredAnalysis & { _type: "analysis"; _source: "local" })
  | (ServerFeedItem & { _type: "query" | "analysis"; _source: "server" });

interface QueryFeedProps {
  onSelect: (item: StoredQuery | StoredAnalysis | null, question?: string) => void;
  refreshKey: number;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function QueryFeed({ onSelect, refreshKey }: QueryFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllQueries().catch(() => [] as StoredQuery[]),
      getAllAnalyses().catch(() => [] as StoredAnalysis[]),
      fetch("/api/feed?limit=50").then((r) => r.json()).then((d) => d.items || []).catch(() => [] as ServerFeedItem[]),
    ])
      .then(([localQueries, localAnalyses, serverItems]) => {
        // Build a set of local question strings for deduplication
        const localQuestions = new Set<string>();
        const tagged: FeedItem[] = [];

        for (const q of localQueries) {
          localQuestions.add(q.question.toLowerCase().trim());
          tagged.push({ ...q, _type: "query", _source: "local" });
        }
        for (const a of localAnalyses) {
          localQuestions.add(a.question.toLowerCase().trim());
          tagged.push({ ...a, _type: "analysis", _source: "local" });
        }

        // Add server items that aren't already in local storage
        for (const s of serverItems as ServerFeedItem[]) {
          if (!localQuestions.has(s.question.toLowerCase().trim())) {
            tagged.push({
              ...s,
              _type: s.route === "analyze" ? "analysis" : "query",
              _source: "server",
            });
          }
        }

        tagged.sort((a, b) => b.timestamp - a.timestamp);
        setItems(tagged);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleClick = (item: FeedItem) => {
    if (item._source === "local") {
      const { _type, _source, ...rest } = item;
      void _type;
      void _source;
      onSelect(rest as StoredQuery | StoredAnalysis);
    } else {
      // Server item — pre-fill the question for the user to re-run
      onSelect(null, item.question);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-dark text-sm">Loading feed...</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Database className="w-12 h-12 text-muted-dark mb-4" />
        <h3 className="text-lg font-medium text-white mb-1">No queries yet</h3>
        <p className="text-sm text-muted-dark max-w-sm">
          Switch to the Query tab and ask a question. All queries will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => handleClick(item)}
          className="w-full text-left glass-card-hover p-4 group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {(item._type === "analysis" || (item._source === "server" && item.route === "analyze")) ? (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
                    <Layers className="w-3 h-3" />
                    Deep
                  </span>
                ) : (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded px-1.5 py-0.5">
                    <Search className="w-3 h-3" />
                    Query
                  </span>
                )}
                <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                  {item.question}
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-dark">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(item.timestamp)}
                </span>
                {item._source === "local" && item._type === "analysis" && (
                  <span>{(item as StoredAnalysis).stepCount} step{(item as StoredAnalysis).stepCount !== 1 ? "s" : ""}</span>
                )}
                {item._source === "local" && item._type === "query" && (
                  <span>{(item as StoredQuery).rowCount} rows</span>
                )}
                {item._source === "server" && (item as ServerFeedItem).stepCount > 0 && (
                  <span>{(item as ServerFeedItem).stepCount} step{(item as ServerFeedItem).stepCount !== 1 ? "s" : ""}</span>
                )}
                {item._source === "server" && (item as ServerFeedItem).rowCount > 0 && (
                  <span>{(item as ServerFeedItem).rowCount} rows</span>
                )}
              </div>
              {item._source === "local" && item._type === "analysis" && (item as StoredAnalysis).summary && (
                <p className="text-xs text-muted-dark mt-1.5 line-clamp-2">
                  {(item as StoredAnalysis).summary}
                </p>
              )}
              {item._source === "server" && (item as ServerFeedItem).summary && (
                <p className="text-xs text-muted-dark mt-1.5 line-clamp-2">
                  {(item as ServerFeedItem).summary}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ChevronRight className="w-4 h-4 text-muted-dark group-hover:text-accent transition-colors" />
            </div>
          </div>
        </button>
      ))}
      <p className="text-center text-xs text-muted-dark pt-2">
        {items.length} {items.length === 1 ? "query" : "queries"} in feed
      </p>
    </div>
  );
}
