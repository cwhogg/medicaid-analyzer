"use client";

import { useState } from "react";
import { Check, AlertCircle, Loader2, ChevronRight, ListChecks } from "lucide-react";
import { SQLDisplay } from "./SQLDisplay";
import { ResultsTable } from "./ResultsTable";
import { ResultsChart } from "./ResultsChart";
import { cn } from "@/lib/utils";
import type { AnalysisStep, AnalysisStatus } from "@/hooks/useAnalysis";

interface AnalysisStepsProps {
  plan: string[] | null;
  planReasoning: string | null;
  steps: AnalysisStep[];
  summary: string | null;
  status: AnalysisStatus;
  error: string | null;
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
  const [chartType, setChartType] = useState<"table" | "line" | "bar" | "pie">(step.chartType || "table");

  const hasResults = step.columns.length > 0 && step.rows.length > 0;

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">{step.title || `Step ${step.stepIndex + 1}`}</h4>
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
        <p className="text-sm text-muted leading-relaxed border-t border-white/[0.08] pt-3">
          {step.insight}
        </p>
      )}
    </div>
  );
}

export function AnalysisSteps({ plan, planReasoning, steps, summary, status, error }: AnalysisStepsProps) {
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
          {/* Vertical line connector */}
          {steps.length > 1 && (
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-white/[0.08]" />
          )}

          {steps.map((step) => (
            <div key={step.stepIndex} className="flex gap-4">
              {/* Step indicator */}
              <div className="flex flex-col items-center shrink-0 z-10">
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
        <div className="glass-card p-5 border-accent/20">
          <h3 className="text-sm font-semibold text-accent mb-3 uppercase tracking-wider">Summary</h3>
          <div className="text-sm text-muted leading-relaxed whitespace-pre-line">
            {summary}
          </div>
        </div>
      )}
    </div>
  );
}
