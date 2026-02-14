"use client";

import { useEffect, useState } from "react";
import { Clock, Trash2, ChevronRight, Database } from "lucide-react";
import { getAllQueries, deleteQuery, type StoredQuery } from "@/lib/queryStore";
import { formatCurrency } from "@/lib/format";

interface QueryFeedProps {
  onSelect: (query: StoredQuery) => void;
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

function summarizeResult(query: StoredQuery): string {
  if (!query.rows.length) return "No results";
  // Try to find a numeric column and summarize
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
  const [queries, setQueries] = useState<StoredQuery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllQueries()
      .then(setQueries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteQuery(id).catch(console.error);
    setQueries((prev) => prev.filter((q) => q.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-dark text-sm">Loading history...</div>
      </div>
    );
  }

  if (!queries.length) {
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
      {queries.map((query) => (
        <button
          key={query.id}
          onClick={() => onSelect(query)}
          className="w-full text-left glass-card-hover p-4 group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                {query.question}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-dark">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(query.timestamp)}
                </span>
                <span>{summarizeResult(query)}</span>
                <span className="capitalize">{query.chartType}</span>
              </div>
              <p className="text-xs text-muted-dark mt-1.5 truncate font-mono opacity-60">
                {query.sql}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => handleDelete(e, query.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-red-400 text-muted-dark"
                title="Delete query"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-4 h-4 text-muted-dark group-hover:text-accent transition-colors" />
            </div>
          </div>
        </button>
      ))}
      <p className="text-center text-xs text-muted-dark pt-2">
        {queries.length} saved {queries.length === 1 ? "query" : "queries"}
      </p>
    </div>
  );
}
