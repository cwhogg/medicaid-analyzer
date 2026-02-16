"use client";

import { useState, type FormEvent } from "react";
import { Check, AlertCircle, Loader2, ChevronRight, ListChecks, Layers, ArrowRight } from "lucide-react";
import { SQLDisplay } from "./SQLDisplay";
import { ResultsTable } from "./ResultsTable";
import { ResultsChart } from "./ResultsChart";
import { cn } from "@/lib/utils";
import type { AnalysisStep, AnalysisStatus } from "@/hooks/useAnalysis";

/** Render a limited subset of markdown (headings, bold, paragraphs) as React elements. */
function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let paraLines: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paraLines.length === 0) return;
    const joined = paraLines.join(" ");
    elements.push(<p key={key++} className="text-sm text-muted leading-relaxed">{renderInline(joined)}</p>);
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
      elements.push(<h4 key={key++} className="text-base font-semibold text-white mt-3 first:mt-0">{renderInline(h1Match[1])}</h4>);
      continue;
    }
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      flushParagraph();
      elements.push(<h5 key={key++} className="text-sm font-semibold text-white/80 mt-3">{renderInline(h2Match[1])}</h5>);
      continue;
    }
    paraLines.push(trimmed);
  }
  flushParagraph();
  return elements;
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
    parts.push(<strong key={key++} className="text-white font-medium">{match[1]}</strong>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

interface AnalysisStepsProps {
  plan: string[] | null;
  planReasoning: string | null;
  steps: AnalysisStep[];
  summary: string | null;
  status: AnalysisStatus;
  error: string | null;
  onRefine?: (instruction: string) => void;
}

function StepIcon({ stepStatus }: { stepStatus: AnalysisStep["status"] }) {
  switch (stepStatus) {
    case "generating_sql":
    case "executing":
      return <Loader2 className="w-4 h-4 animate-spin text-accent" />;
    case "complete":
      return <Check className="w-4 h-4 text-green-400" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <div className="w-4 h-4 rounded-full border border-white/20" />;
  }
}

function StepStatusLabel({ stepStatus }: { stepStatus: AnalysisStep["status"] }) {
  switch (stepStatus) {
    case "generating_sql":
      return <span className="text-accent text-xs">Generating SQL...</span>;
    case "executing":
      return <span className="text-accent text-xs">Executing query...</span>;
    case "complete":
      return <span className="text-green-400 text-xs">Complete</span>;
    case "error":
      return <span className="text-red-400 text-xs">Error</span>;
    default:
      return <span className="text-muted-dark text-xs">Pending</span>;
  }
}

function StepCard({ step }: { step: AnalysisStep }) {
  const [showResults, setShowResults] = useState(true);
  const [chartType, setChartType] = useState<"table" | "line" | "bar" | "pie">("table");

  const hasResults = step.columns.length > 0 && step.rows.length > 0;

  return (
    <div className="glass-card p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-white min-w-0 truncate">{step.title || `Step ${step.stepIndex + 1}`}</h4>
        <StepStatusLabel stepStatus={step.status} />
      </div>

      {step.sql && <SQLDisplay sql={step.sql} />}

      {step.error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {step.error}
        </div>
      )}

      {hasResults && (
        <div className="space-y-2">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          >
            <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", showResults && "rotate-90")} />
            {step.rows.length} row{step.rows.length !== 1 ? "s" : ""}
          </button>

          {showResults && (
            <>
              {/* Mini chart type toggle */}
              <div className="flex items-center gap-1">
                {(["table", "bar", "line", "pie"] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setChartType(ct)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      chartType === ct
                        ? "bg-accent text-white"
                        : "text-muted-dark hover:text-white"
                    )}
                  >
                    {ct.charAt(0).toUpperCase() + ct.slice(1)}
                  </button>
                ))}
              </div>

              {chartType === "table" ? (
                <ResultsTable columns={step.columns} rows={step.rows} />
              ) : (
                <ResultsChart columns={step.columns} rows={step.rows} chartType={chartType} />
              )}
            </>
          )}
        </div>
      )}

      {step.insight && (
        <div className="text-sm text-muted leading-relaxed border-t border-white/[0.08] pt-3">
          {renderInline(step.insight)}
        </div>
      )}
    </div>
  );
}

export function AnalysisSteps({ plan, planReasoning, steps, summary, status, error, onRefine }: AnalysisStepsProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState("");

  const handleRefineSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!refineText.trim() || !onRefine) return;
    onRefine(refineText.trim());
    setRefineText("");
    setRefineOpen(false);
  };
  // Map plan[i] to its corresponding step: steps store stepIndex starting at 1,
  // so plan[0] corresponds to steps.find(s => s.stepIndex === 1), etc.
  const getStepForPlanIndex = (planIndex: number): AnalysisStep | undefined =>
    steps.find((s) => s.stepIndex === planIndex + 1);

  return (
    <div className="space-y-4">
      {/* Plan display */}
      {plan && plan.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <ListChecks className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-medium text-white">Analysis Plan</h3>
          </div>
          <ol className="space-y-1.5 ml-1">
            {plan.map((step, i) => {
              const matchedStep = getStepForPlanIndex(i);
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={cn(
                    "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium mt-0.5",
                    matchedStep
                      ? matchedStep.status === "error"
                        ? "bg-red-500/20 text-red-400"
                        : matchedStep.status === "complete"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-accent/20 text-accent"
                      : "bg-white/[0.08] text-muted-dark"
                  )}>
                    {i + 1}
                  </span>
                  <span className={cn(
                    matchedStep ? "text-muted" : "text-muted-dark"
                  )}>
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
          {planReasoning && (
            <p className="text-xs text-muted-dark italic mt-3 ml-1">{planReasoning}</p>
          )}
        </div>
      )}

      {/* Steps timeline */}
      {steps.length > 0 && (
        <div className="relative space-y-4">
          {/* Vertical line connector — hidden on mobile */}
          {steps.length > 1 && (
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-white/[0.08] hidden sm:block" />
          )}

          {steps.map((step) => (
            <div key={step.stepIndex} className="flex gap-2 sm:gap-4">
              {/* Step indicator — hidden on mobile to maximize content width */}
              <div className="hidden sm:flex flex-col items-center shrink-0 z-10">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  step.status === "complete" ? "bg-green-500/10 border border-green-500/30" :
                  step.status === "error" ? "bg-red-500/10 border border-red-500/30" :
                  "bg-accent/10 border border-accent/30"
                )}>
                  <StepIcon stepStatus={step.status} />
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0 pb-2">
                <StepCard step={step} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Planning/running loader */}
      {(status === "planning" && steps.length === 0) && (
        <div className="glass-card p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <p className="text-sm text-muted">Planning analysis...</p>
        </div>
      )}

      {/* Global error */}
      {status === "error" && error && (
        <div className="glass-card p-4 border-red-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Cancelled */}
      {status === "cancelled" && (
        <div className="glass-card p-4 border-yellow-500/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">Analysis was cancelled.</p>
        </div>
      )}

      {/* Summary */}
      {summary && status === "complete" && (
        <>
          <div className="glass-card p-5 border-accent/20">
            <h3 className="text-sm font-semibold text-accent mb-3 uppercase tracking-wider">Summary</h3>
            <div className="space-y-2">
              {renderMarkdown(summary)}
            </div>
          </div>

          {/* Refine Analysis */}
          {onRefine && (
            <div>
              {refineOpen ? (
                <form onSubmit={handleRefineSubmit} className="glass-card p-4 space-y-3">
                  <label className="text-sm font-medium text-white">Add instructions to refine analysis</label>
                  <input
                    type="text"
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder="e.g. Break down by state, focus on top 5 providers, compare year-over-year..."
                    autoFocus
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-muted-dark outline-none focus:border-accent/50 transition-colors"
                    maxLength={500}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={!refineText.trim()}
                      className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Layers className="w-4 h-4" />
                      Run Refined Analysis
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRefineOpen(false); setRefineText(""); }}
                      className="py-2 px-4 text-sm text-muted hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setRefineOpen(true)}
                  className="w-full py-3 px-4 text-sm flex items-center justify-center gap-2 rounded-xl border border-accent/30 text-accent hover:bg-accent/10 transition-colors"
                >
                  <Layers className="w-4 h-4" />
                  Refine Analysis
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
