"use client";

import { useEffect, useState } from "react";
import { Clock, Trash2, ChevronRight, Database, Layers } from "lucide-react";
import { getAllQueries, deleteQuery, getAllAnalyses, deleteAnalysis, type StoredQuery, type StoredAnalysis } from "@/lib/queryStore";
import { formatCurrency } from "@/lib/format";

type FeedItem = (StoredQuery & { _type: "query" }) | (StoredAnalysis & { _type: "analysis" });

interface QueryFeedProps {
  onSelect: (item: StoredQuery | StoredAnalysis) => void;
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

function summarizeQueryResult(query: StoredQuery): string {
  if (!query.rows.length) return "No results";
  const numColIdx = query.columns.findIndex((_, i) => {
    const v = query.rows[0]?.[i];
    return typeof v === "number" && v > 1000;
  });
  if (numColIdx !== -1) {
    const col = query.columns[numColIdx];
    const val = query.rows[0][numColIdx] as number;
    const label = col.toLowerCase().includes("paid") || col.toLowerCase().includes("spending")
      ? formatCurrency(val)
      : val.toLocaleString();
    return `${query.rowCount} rows | Top: ${label}`;
  }
  return `${query.rowCount} rows`;
}

export function QueryFeed({ onSelect, refreshKey }: QueryFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllQueries().catch(() => [] as StoredQuery[]),
      getAllAnalyses().catch(() => [] as StoredAnalysis[]),
    ])
      .then(([queries, analyses]) => {
        const tagged: FeedItem[] = [
          ...queries.map((q) => ({ ...q, _type: "query" as const })),
          ...analyses.map((a) => ({ ...a, _type: "analysis" as const })),
        ];
        tagged.sort((a, b) => b.timestamp - a.timestamp);
        setItems(tagged);
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, item: FeedItem) => {
    e.stopPropagation();
    if (item._type === "analysis") {
      await deleteAnalysis(item.id).catch(console.error);
    } else {
      await deleteQuery(item.id).catch(console.error);
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-dark text-sm">Loading history...</div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Database className="w-12 h-12 text-muted-dark mb-4" />
        <h3 className="text-lg font-medium text-white mb-1">No queries yet</h3>
        <p className="text-sm text-muted-dark max-w-sm">
          Switch to the Query tab and ask a question. Your results will be saved here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => {
            // Strip the _type field before passing to parent
            const { _type, ...rest } = item;
            void _type;
            onSelect(rest as StoredQuery | StoredAnalysis);
          }}
          className="w-full text-left glass-card-hover p-4 group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {item._type === "analysis" && (
                  <span className="shrink-0 flex items-center gap-1 text-xs text-accent bg-accent/10 border border-accent/20 rounded px-1.5 py-0.5">
                    <Layers className="w-3 h-3" />
                    Deep
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
                {item._type === "analysis" ? (
                  <span>{item.stepCount} step{item.stepCount !== 1 ? "s" : ""}</span>
                ) : (
                  <span>{summarizeQueryResult(item)}</span>
                )}
              </div>
              {item._type === "query" && (
                <p className="text-xs text-muted-dark mt-1.5 truncate font-mono opacity-60">
                  {item.sql}
                </p>
              )}
              {item._type === "analysis" && item.summary && (
                <p className="text-xs text-muted-dark mt-1.5 line-clamp-2">
                  {item.summary}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => handleDelete(e, item)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400 text-muted-dark"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted-dark group-hover:text-accent transition-colors" />
            </div>
          </div>
        </button>
      ))}
      <p className="text-center text-xs text-muted-dark pt-2">
        {items.length} saved {items.length === 1 ? "item" : "items"}
      </p>
    </div>
  );
}
