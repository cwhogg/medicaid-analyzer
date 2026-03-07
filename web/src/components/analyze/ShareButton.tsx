"use client";

import { useState } from "react";
import { Share2, Check, Loader2 } from "lucide-react";

interface SharePayload {
  question: string;
  dataset: string;
  type: "query" | "analysis";
  sql?: string;
  columns?: string[];
  rows?: unknown[][];
  totalRows?: number;
  plan?: string[];
  steps?: {
    stepIndex: number;
    title: string;
    sql: string | null;
    chartType: string;
    columns: string[];
    rows: unknown[][];
    totalRows?: number;
    insight: string | null;
    error: string | null;
  }[];
  summary?: string | null;
  timestamp: number;
}

interface ShareButtonProps {
  payload: SharePayload;
}

const MAX_ROWS = 100;

function truncateRows(rows: unknown[][]): { truncated: unknown[][]; total: number } {
  return {
    truncated: rows.slice(0, MAX_ROWS),
    total: rows.length,
  };
}

function buildShareData(payload: SharePayload): SharePayload {
  const data = { ...payload };

  if (data.rows) {
    const { truncated, total } = truncateRows(data.rows);
    data.rows = truncated;
    data.totalRows = total;
  }

  if (data.steps) {
    data.steps = data.steps.map((step) => {
      const { truncated, total } = truncateRows(step.rows || []);
      return { ...step, rows: truncated, totalRows: total };
    });
  }

  return data;
}

function generateShareId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return uuid.slice(0, 10);
}

export function ShareButton({ payload }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "copied" | "error">("idle");

  const handleShare = async () => {
    if (status === "saving") return;

    setStatus("saving");

    try {
      const id = generateShareId();
      const shareData = buildShareData(payload);

      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data: shareData }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      const shareUrl = `${window.location.origin}/share/${id}`;
      await navigator.clipboard.writeText(shareUrl);

      setStatus("copied");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      onClick={handleShare}
      disabled={status === "saving"}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-rule rounded-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
    >
      {status === "saving" ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving...
        </>
      ) : status === "copied" ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          Link copied
        </>
      ) : status === "error" ? (
        <>
          <Share2 className="w-3.5 h-3.5 text-red-600" />
          Failed
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" />
          Share
        </>
      )}
    </button>
  );
}
