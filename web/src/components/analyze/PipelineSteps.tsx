"use client";

import { Loader2, Check, AlertCircle, Database, Brain, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConceptExtraction, DatasetSelection } from "@/lib/datasetRouter";
import type { AnalysisStatus } from "@/hooks/useAnalysis";

// Color map for dataset chips
const DATASET_COLORS: Record<string, string> = {
  medicaid: "bg-red-100 text-red-800 border-red-200",
  medicare: "bg-teal-100 text-teal-800 border-teal-200",
  "medicare-inpatient": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "medicare-partd": "bg-cyan-100 text-cyan-800 border-cyan-200",
  brfss: "bg-blue-100 text-blue-800 border-blue-200",
  nhanes: "bg-purple-100 text-purple-800 border-purple-200",
  dac: "bg-pink-100 text-pink-800 border-pink-200",
};

const DATASET_LABELS: Record<string, string> = {
  medicaid: "Medicaid",
  medicare: "Medicare Part B",
  "medicare-inpatient": "Medicare Inpatient",
  "medicare-partd": "Medicare Part D",
  brfss: "BRFSS",
  nhanes: "NHANES",
  dac: "Clinician Directory",
};

interface PipelineStepsProps {
  status: AnalysisStatus;
  conceptExtraction: ConceptExtraction | null;
  datasetSelection: DatasetSelection | null;
  detectedDatasets: string[] | null;
}

type StepStatus = "pending" | "running" | "complete" | "error";

function StepStatusIcon({ stepStatus }: { stepStatus: StepStatus }) {
  switch (stepStatus) {
    case "running":
      return <Loader2 className="w-4 h-4 animate-spin text-accent" />;
    case "complete":
      return <Check className="w-4 h-4 text-green-600" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    default:
      return <div className="w-4 h-4 rounded-full border border-rule" />;
  }
}

function getStepStatus(
  stepName: "concepts" | "datasets",
  status: AnalysisStatus,
  conceptExtraction: ConceptExtraction | null,
  datasetSelection: DatasetSelection | null,
): StepStatus {
  if (stepName === "concepts") {
    if (conceptExtraction) return "complete";
    if (status === "routing") return "running";
    return "pending";
  }
  if (stepName === "datasets") {
    if (datasetSelection && status !== "routing" && status !== "clarifying") return "complete";
    if (conceptExtraction && (status === "routing" || status === "clarifying")) return "running";
    return "pending";
  }
  return "pending";
}

export function PipelineSteps({ status, conceptExtraction, datasetSelection, detectedDatasets }: PipelineStepsProps) {
  const conceptStatus = getStepStatus("concepts", status, conceptExtraction, datasetSelection);
  const datasetStatus = getStepStatus("datasets", status, conceptExtraction, datasetSelection);

  // Don't render at all if nothing is happening
  if (!conceptExtraction && status !== "routing") return null;

  return (
    <div className="space-y-2">
      {/* Step 1: Concept Extraction */}
      <div className="card p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <StepStatusIcon stepStatus={conceptStatus} />
          <Brain className="w-4 h-4 text-muted" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Concept Extraction</span>
        </div>
        {conceptExtraction && (
          <div className="ml-6 mt-2 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {conceptExtraction.concepts.map((c) => (
                <span key={c} className="px-2 py-0.5 rounded-sm text-xs font-medium bg-background border border-rule text-body">
                  {c}
                </span>
              ))}
            </div>
            {conceptExtraction.timeRange && (
              <p className="text-xs text-muted">Time range: {conceptExtraction.timeRange}</p>
            )}
            {conceptExtraction.comparisonIntent && (
              <p className="text-xs text-muted">Cross-dataset comparison detected</p>
            )}
          </div>
        )}
        {!conceptExtraction && status === "routing" && (
          <p className="ml-6 mt-1 text-xs text-muted">Analyzing question...</p>
        )}
      </div>

      {/* Step 2: Dataset Selection */}
      {(conceptExtraction || status === "routing") && (
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <StepStatusIcon stepStatus={datasetStatus} />
            <Database className="w-4 h-4 text-muted" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Dataset Selection</span>
          </div>
          {detectedDatasets && detectedDatasets.length > 0 && (
            <div className="ml-6 mt-2 space-y-1.5">
              <div className="flex flex-wrap gap-1.5">
                {detectedDatasets.map((d) => (
                  <span
                    key={d}
                    className={cn(
                      "px-2 py-0.5 rounded-sm text-xs font-semibold border",
                      DATASET_COLORS[d] || "bg-gray-100 text-gray-800 border-gray-200"
                    )}
                  >
                    {DATASET_LABELS[d] || d}
                  </span>
                ))}
              </div>
              {datasetSelection?.reasoning && (
                <p className="text-xs text-muted">{datasetSelection.reasoning}</p>
              )}
              {datasetSelection?.joinStrategy && datasetSelection.joinStrategy !== "none" && (
                <p className="text-xs text-muted">
                  Strategy: {datasetSelection.joinStrategy === "sql_join" ? "SQL JOIN" : datasetSelection.joinStrategy === "parallel_queries" ? "Parallel queries" : "Narrative comparison"}
                  {datasetSelection.joinKeys?.length ? ` on ${datasetSelection.joinKeys.join(", ")}` : ""}
                </p>
              )}
            </div>
          )}
          {!detectedDatasets && conceptExtraction && (
            <p className="ml-6 mt-1 text-xs text-muted">Selecting datasets...</p>
          )}
        </div>
      )}

      {/* Planning indicator — transition between routing and main analysis */}
      {(status === "planning" && detectedDatasets) && (
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <ListChecks className="w-4 h-4 text-muted" />
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Planning Analysis</span>
          </div>
          <p className="ml-6 mt-1 text-xs text-muted">Creating analysis plan...</p>
        </div>
      )}
    </div>
  );
}

// Dataset chips used elsewhere (e.g., after routing completes)
export function DatasetChips({ datasets }: { datasets: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {datasets.map((d) => (
        <span
          key={d}
          className={cn(
            "px-2 py-0.5 rounded-sm text-xs font-semibold border",
            DATASET_COLORS[d] || "bg-gray-100 text-gray-800 border-gray-200"
          )}
        >
          {DATASET_LABELS[d] || d}
        </span>
      ))}
    </div>
  );
}
