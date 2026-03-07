"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ExternalLink, ChevronRight, Code, AlertCircle } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SQLDisplay } from "@/components/analyze/SQLDisplay";
import { ResultsTable } from "@/components/analyze/ResultsTable";
import { ResultsChart } from "@/components/analyze/ResultsChart";
import { cn } from "@/lib/utils";

interface ShareStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  chartType: string;
  columns: string[];
  rows: unknown[][];
  totalRows?: number;
  insight: string | null;
  error: string | null;
}

interface ShareData {
  question: string;
  dataset: string;
  type: "query" | "analysis";
  sql?: string;
  columns?: string[];
  rows?: unknown[][];
  totalRows?: number;
  plan?: string[];
  steps?: ShareStep[];
  summary?: string | null;
  timestamp: number;
}

interface SharedResultViewProps {
  data: ShareData;
  shareId: string;
}

function TruncationNotice({ shown, total }: { shown: number; total: number }) {
  if (total <= shown) return null;
  return (
    <p className="text-xs text-muted italic">
      Showing {shown} of {total.toLocaleString()} rows
    </p>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={key++} className="text-foreground font-semibold">{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let paraLines: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paraLines.length === 0) return;
    const joined = paraLines.join(" ");
    elements.push(<p key={key++} className="text-sm text-body leading-relaxed font-serif">{renderInline(joined)}</p>);
    paraLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flushParagraph();
      continue;
    }
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      flushParagraph();
      elements.push(<h4 key={key++} className="text-base font-headline font-bold text-foreground mt-3 first:mt-0">{renderInline(h1Match[1])}</h4>);
      continue;
    }
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushParagraph();
      elements.push(<h5 key={key++} className="text-sm font-semibold text-foreground/80 mt-3">{renderInline(h2Match[1])}</h5>);
      continue;
    }
    paraLines.push(trimmed);
  }
  flushParagraph();
  return elements;
}

function SharedStepCard({ step }: { step: ShareStep }) {
  const [showResults, setShowResults] = useState(true);
  const [chartType, setChartType] = useState<"table" | "line" | "bar" | "pie">("table");

  const hasResults = step.columns.length > 0 && step.rows.length > 0;

  return (
    <div className="card p-3 sm:p-4 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        {step.title || `Step ${step.stepIndex}`}
      </h4>

      {step.sql && <SQLDisplay sql={step.sql} />}

      {step.error && (
        <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {step.error}
        </div>
      )}

      {hasResults && (
        <div className="space-y-2">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showResults && "rotate-90")} />
            {step.rows.length} row{step.rows.length !== 1 ? "s" : ""}
          </button>

          {showResults && (
            <>
              <div className="flex items-center gap-1">
                {(["table", "bar", "line", "pie"] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setChartType(ct)}
                    className={cn(
                      "px-2 py-1 rounded-sm text-xs font-medium transition-colors",
                      chartType === ct
                        ? "bg-accent text-white"
                        : "text-muted hover:text-foreground"
                    )}
                  >
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </button>
                ))}
              </div>

              {chartType === "table" ? (
                <ResultsTable columns={step.columns} rows={step.rows} title={step.title || undefined} />
              ) : (
                <ResultsChart columns={step.columns} rows={step.rows} chartType={chartType} />
              )}

              {step.totalRows != null && (
                <TruncationNotice shown={step.rows.length} total={step.totalRows} />
              )}
            </>
          )}
        </div>
      )}

      {step.insight && (
        <div className="text-sm text-body leading-relaxed border-t border-rule-light pt-3 font-serif">
          {renderInline(step.insight)}
        </div>
      )}
    </div>
  );
}

export function SharedResultView({ data, shareId }: SharedResultViewProps) {
  const [copied, setCopied] = useState(false);
  const [chartType, setChartType] = useState<"table" | "line" | "bar" | "pie">("table");

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/share/${shareId}`
    : `/share/${shareId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const datasetLabel = data.dataset?.toUpperCase() || "DATA";
  const continueUrl = `/${data.dataset || "medicaid"}?q=${encodeURIComponent(data.question)}`;
  const sharedAt = new Date(data.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-12">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* Header */}
          <div className="mb-6">
            <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-accent mb-1">
              {datasetLabel} &middot; Shared Analysis
            </div>
            <h1 className="font-headline text-xl sm:text-2xl font-bold text-foreground leading-tight mb-2">
              {data.question}
            </h1>
            <p className="text-xs text-muted">
              Shared on {sharedAt}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-rule rounded-sm text-muted hover:text-foreground transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy link
                </>
              )}
            </button>
            <Link
              href={continueUrl}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-accent text-white rounded-sm hover:bg-accent/90 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Continue in {datasetLabel}
            </Link>
          </div>

          <hr className="rule mb-6" />

          {/* Single query results */}
          {data.type === "query" && data.sql && (
            <div className="space-y-4">
              <SQLDisplay sql={data.sql} />

              {data.columns && data.rows && data.rows.length > 0 && (
                <>
                  <div className="flex items-center gap-1">
                    {(["table", "bar", "line", "pie"] as const).map((ct) => (
                      <button
                        key={ct}
                        onClick={() => setChartType(ct)}
                        className={cn(
                          "px-2 py-1 rounded-sm text-xs font-medium transition-colors",
                          chartType === ct
                            ? "bg-accent text-white"
                            : "text-muted hover:text-foreground"
                        )}
                      >
                        {ct.charAt(0).toUpperCase() + ct.slice(1)}
                      </button>
                    ))}
                  </div>

                  {chartType === "table" ? (
                    <ResultsTable columns={data.columns} rows={data.rows} title={data.question} />
                  ) : (
                    <ResultsChart columns={data.columns} rows={data.rows} chartType={chartType} />
                  )}

                  {data.totalRows != null && (
                    <TruncationNotice shown={data.rows.length} total={data.totalRows} />
                  )}
                </>
              )}
            </div>
          )}

          {/* Deep analysis results */}
          {data.type === "analysis" && (
            <div className="space-y-4">
              {/* Plan */}
              {data.plan && data.plan.length > 0 && (
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Code className="w-4 h-4 text-accent" />
                    Analysis Plan
                  </h3>
                  <ol className="space-y-1.5 ml-1">
                    {data.plan.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium mt-0.5 bg-green-50 text-green-700 border border-green-200">
                          {i + 1}
                        </span>
                        <span className="text-body">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Steps */}
              {data.steps && data.steps.length > 0 && (
                <div className="space-y-4">
                  {data.steps.map((step) => (
                    <SharedStepCard key={step.stepIndex} step={step} />
                  ))}
                </div>
              )}

              {/* Summary */}
              {data.summary && (
                <div className="card p-5 border-l-[3px] border-l-accent">
                  <h3 className="text-[0.6875rem] font-bold text-accent mb-3 uppercase tracking-[0.14em]">Summary</h3>
                  <div className="space-y-2">
                    {renderMarkdown(data.summary)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
