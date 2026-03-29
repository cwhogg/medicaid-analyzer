"use client";

import { useState, useCallback, useRef } from "react";
import { saveAnalysis, type StoredAnalysis } from "@/lib/queryStore";
import type { ConceptExtraction, DatasetSelection } from "@/lib/datasetRouter";

const MAX_STEPS = 5; // step 0 = plan, steps 1-4 = SQL queries

export type AnalysisStepStatus = "pending" | "generating_sql" | "executing" | "complete" | "error";

export interface AnalysisStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  chartType: "table" | "line" | "bar" | "pie";
  columns: string[];
  rows: unknown[][];
  insight: string | null;
  status: AnalysisStepStatus;
  error: string | null;
}

export type AnalysisStatus = "idle" | "routing" | "planning" | "running" | "complete" | "error" | "cancelled" | "clarifying";

interface AnalysisState {
  sessionId: string | null;
  question: string | null;
  plan: string[] | null;
  planReasoning: string | null;
  complexity: string | null;
  steps: AnalysisStep[];
  summary: string | null;
  status: AnalysisStatus;
  error: string | null;
  // Unified pipeline fields
  conceptExtraction: ConceptExtraction | null;
  datasetSelection: DatasetSelection | null;
  detectedDatasets: string[] | null;
  clarification: { question: string; options: string[] } | null;
}

interface CompletedStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  chartType: string;
  columns: string[];
  rows: unknown[][];
  resultSummary: string | null;
  insight: string | null;
  error: string | null;
}

export interface PriorAnalysis {
  question: string;
  summary: string;
  steps: { title: string; insight: string | null }[];
}

export interface PriorContext {
  /** Chain of all prior analyses, oldest first */
  history: PriorAnalysis[];
}

export function useAnalysis() {
  const abortRef = useRef<AbortController | null>(null);
  const planRef = useRef<string[] | null>(null);
  // Store resolved datasets for passing to subsequent API calls
  const resolvedDatasetsRef = useRef<string[] | null>(null);
  const joinStrategyRef = useRef<string | null>(null);

  const [state, setState] = useState<AnalysisState>({
    sessionId: null,
    question: null,
    plan: null,
    planReasoning: null,
    complexity: null,
    steps: [],
    summary: null,
    status: "idle",
    error: null,
    conceptExtraction: null,
    datasetSelection: null,
    detectedDatasets: null,
    clarification: null,
  });

  const runAnalysisPipeline = useCallback(
    async (
      question: string,
      sessionId: string,
      abortController: AbortController,
      dataset: string,
      years: number[] | null,
      priorContext: PriorContext | null,
      clarificationAnswer?: string,
    ) => {
      const completedSteps: CompletedStep[] = [];
      const isAutoMode = dataset === "auto";

      // --- Routing steps (auto mode only) ---
      if (isAutoMode) {
        // Step -2: Concept extraction
        setState((prev) => ({ ...prev, status: "routing" }));

        const conceptResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            dataset: "auto",
            sessionId,
            stepIndex: -2,
          }),
          signal: abortController.signal,
        });

        if (!conceptResponse.ok) {
          const errData = await conceptResponse.json().catch(() => ({}));
          throw new Error(errData.error || `Concept extraction failed: ${conceptResponse.status}`);
        }

        const conceptData = await conceptResponse.json();
        if (abortController.signal.aborted) {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }

        setState((prev) => ({
          ...prev,
          conceptExtraction: conceptData.conceptExtraction,
        }));

        // Step -1: Dataset selection
        const selectionResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            dataset: "auto",
            sessionId,
            stepIndex: -1,
            ...(clarificationAnswer ? { clarificationAnswer } : {}),
          }),
          signal: abortController.signal,
        });

        if (!selectionResponse.ok) {
          const errData = await selectionResponse.json().catch(() => ({}));
          throw new Error(errData.error || `Dataset selection failed: ${selectionResponse.status}`);
        }

        const selectionData = await selectionResponse.json();
        if (abortController.signal.aborted) {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }

        setState((prev) => ({
          ...prev,
          datasetSelection: selectionData.datasetSelection,
        }));

        // Check if clarification is needed
        if (selectionData.clarification && !clarificationAnswer) {
          setState((prev) => ({
            ...prev,
            status: "clarifying",
            clarification: selectionData.clarification,
            detectedDatasets: selectionData.datasetSelection?.datasets || null,
          }));
          return; // Stop here; user must respond
        }

        // Store resolved datasets
        const resolved = selectionData.datasetSelection?.datasets || ["medicaid"];
        resolvedDatasetsRef.current = resolved;
        joinStrategyRef.current = selectionData.datasetSelection?.joinStrategy || "none";

        setState((prev) => ({
          ...prev,
          detectedDatasets: resolved,
          status: "planning",
        }));
      }

      // --- Analysis steps (0 through MAX_STEPS-1) ---
      for (let stepIndex = 0; stepIndex < MAX_STEPS; stepIndex++) {
        if (abortController.signal.aborted) {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }

        // Step 0 is plan-only — don't push a placeholder step card
        if (stepIndex === 0) {
          // Keep status as "planning" — no step card created
        } else {
          // Push placeholder step card for SQL steps
          const planTitle = planRef.current?.[stepIndex - 1];
          const placeholderTitle = planTitle ? planTitle.split(":")[0] : "";
          setState((prev) => ({
            ...prev,
            status: "running",
            steps: [
              ...prev.steps,
              {
                stepIndex,
                title: placeholderTitle,
                sql: null,
                chartType: "table",
                columns: [],
                rows: [],
                insight: null,
                status: "generating_sql",
                error: null,
              },
            ],
          }));
        }

        // Build request body
        const requestBody: Record<string, unknown> = {
          question,
          years: years ?? null,
          dataset: isAutoMode ? "auto" : dataset,
          sessionId,
          stepIndex,
          previousSteps: completedSteps,
          ...(stepIndex === 0 && priorContext ? { priorContext } : {}),
        };

        // Include resolved datasets for auto mode (step 0+)
        if (isAutoMode && resolvedDatasetsRef.current) {
          requestBody.resolvedDatasets = resolvedDatasetsRef.current;
          requestBody.joinStrategy = joinStrategyRef.current;
        }

        // Call API
        const apiResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: abortController.signal,
        });

        if (!apiResponse.ok) {
          const errData = await apiResponse.json().catch(() => ({}));
          throw new Error(errData.error || `API error: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();

        if (abortController.signal.aborted) {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }

        // Step 0: plan-only response — store plan and continue to step 1
        if (stepIndex === 0) {
          if (data.plan) {
            planRef.current = data.plan;
            setState((prev) => ({
              ...prev,
              plan: data.plan,
              planReasoning: data.reasoning || null,
              complexity: data.complexity || null,
            }));
          }
          completedSteps.push({
            stepIndex: 0,
            title: "Analysis Plan",
            sql: null,
            chartType: "table",
            columns: [],
            rows: [],
            resultSummary: null,
            insight: data.reasoning || null,
            error: null,
          });
          continue;
        }

        // Handle revised plan from later steps
        if (data.plan && stepIndex > 1) {
          planRef.current = data.plan;
          setState((prev) => ({ ...prev, plan: data.plan }));
        }

        const arrayIndex = stepIndex - 1;

        // If a step has cannotAnswer, treat it as completed with the explanation
        if (data.step?.cannotAnswer) {
          setState((prev) => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
              i === arrayIndex
                ? { ...s, title: data.step.title || "Cannot answer", sql: null, status: "complete" as const, insight: data.step.cannotAnswer }
                : s
            ),
            ...(data.done ? { summary: data.summary || data.step.cannotAnswer, status: "complete" as const } : {}),
          }));

          completedSteps.push({
            stepIndex,
            title: data.step.title || "Cannot answer",
            sql: null,
            chartType: "table",
            columns: [],
            rows: [],
            resultSummary: null,
            insight: data.step.cannotAnswer,
            error: null,
          });

          if (data.done) {
            await saveToStore({
              sessionId,
              question,
              plan: planRef.current || data.plan || null,
              steps: completedSteps,
              summary: data.summary || data.step.cannotAnswer,
              dataset,
            });
            return;
          }
          continue;
        }

        // If done with just a summary (no more SQL)
        if (data.done && !data.step?.sql) {
          setState((prev) => ({
            ...prev,
            summary: data.summary || null,
            status: "complete",
            steps: prev.steps.slice(0, -1),
          }));

          await saveToStore({
            sessionId,
            question,
            plan: planRef.current || data.plan || null,
            steps: completedSteps,
            summary: data.summary,
            dataset,
          });
          return;
        }

        if (!data.step) {
          throw new Error("API returned no step data.");
        }

        const step = data.step;
        const stepColumns: string[] = step.columns || [];
        const stepRows: unknown[][] = step.rows || [];
        const stepError: string | null = step.error || null;

        // Update step with results from server
        setState((prev) => ({
          ...prev,
          steps: prev.steps.map((s, i) =>
            i === arrayIndex
              ? {
                  ...s,
                  stepIndex,
                  title: step.title || `Step ${stepIndex}`,
                  sql: step.sql,
                  chartType: step.chartType || "table",
                  columns: stepColumns,
                  rows: stepRows,
                  status: stepError ? "error" as const : "complete" as const,
                  error: stepError,
                  insight: step.insight || null,
                }
              : s
          ),
        }));

        completedSteps.push({
          stepIndex,
          title: step.title || `Step ${stepIndex}`,
          sql: step.sql,
          chartType: step.chartType || "table",
          columns: stepColumns,
          rows: stepRows,
          resultSummary: step.resultSummary || null,
          insight: step.insight || null,
          error: stepError,
        });

        if (data.done) {
          setState((prev) => ({
            ...prev,
            summary: data.summary || null,
            status: "complete",
          }));

          await saveToStore({
            sessionId,
            question,
            plan: planRef.current || data.plan || null,
            steps: completedSteps,
            summary: data.summary,
            dataset,
          });
          return;
        }
      }

      // Reached max steps without "done"
      setState((prev) => ({
        ...prev,
        status: "complete",
        summary: prev.summary || "Analysis reached the maximum number of steps.",
      }));

      await saveToStore({
        sessionId,
        question,
        plan: planRef.current,
        steps: completedSteps,
        summary: "Analysis reached the maximum number of steps.",
        dataset,
      });
    },
    []
  );

  const startAnalysis = useCallback(
    async (question: string, years?: number[] | null, priorContext?: PriorContext | null, dataset: string = "medicaid") => {
      if (!question.trim()) return;

      // Cancel any in-flight analysis
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      const sessionId = crypto.randomUUID();
      planRef.current = null;
      resolvedDatasetsRef.current = null;
      joinStrategyRef.current = null;

      setState({
        sessionId,
        question,
        plan: null,
        planReasoning: null,
        complexity: null,
        steps: [],
        summary: null,
        status: dataset === "auto" ? "routing" : "planning",
        error: null,
        conceptExtraction: null,
        datasetSelection: null,
        detectedDatasets: null,
        clarification: null,
      });

      try {
        await runAnalysisPipeline(
          question,
          sessionId,
          abortController,
          dataset,
          years ?? null,
          priorContext ?? null,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      }
    },
    [runAnalysisPipeline]
  );

  const respondToClarification = useCallback(
    async (answer: string) => {
      const { sessionId, question } = state;
      if (!sessionId || !question) return;

      // Cancel any in-flight
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      setState((prev) => ({
        ...prev,
        status: "routing",
        clarification: null,
      }));

      try {
        await runAnalysisPipeline(
          question,
          sessionId,
          abortController,
          "auto",
          null,
          null,
          answer,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setState((prev) => ({ ...prev, status: "cancelled" }));
          return;
        }
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      }
    },
    [state, runAnalysisPipeline]
  );

  const cancelAnalysis = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState((prev) => ({ ...prev, status: "cancelled" }));
  }, []);

  const loadStoredAnalysis = useCallback((analysis: StoredAnalysis) => {
    setState({
      sessionId: analysis.id,
      question: analysis.question,
      plan: analysis.plan,
      planReasoning: null,
      complexity: null,
      steps: analysis.steps.map((s) => ({
        stepIndex: s.stepIndex,
        title: s.title,
        sql: s.sql,
        chartType: (s.chartType as AnalysisStep["chartType"]) || "table",
        columns: s.columns || [],
        rows: s.rows || [],
        insight: s.insight,
        status: s.error ? "error" : "complete",
        error: s.error,
      })),
      summary: analysis.summary,
      status: "complete",
      error: null,
      conceptExtraction: null,
      datasetSelection: null,
      detectedDatasets: null,
      clarification: null,
    });
  }, []);

  const clearAnalysis = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    resolvedDatasetsRef.current = null;
    joinStrategyRef.current = null;
    setState({
      sessionId: null,
      question: null,
      plan: null,
      planReasoning: null,
      complexity: null,
      steps: [],
      summary: null,
      status: "idle",
      error: null,
      conceptExtraction: null,
      datasetSelection: null,
      detectedDatasets: null,
      clarification: null,
    });
  }, []);

  return {
    ...state,
    startAnalysis,
    respondToClarification,
    cancelAnalysis,
    loadStoredAnalysis,
    clearAnalysis,
  };
}

async function saveToStore(data: {
  sessionId: string;
  question: string;
  plan: string[] | null;
  steps: CompletedStep[];
  summary: string | null | undefined;
  dataset?: string;
}) {
  const filteredSteps = data.steps
    .filter((s) => s.stepIndex > 0) // Don't store the plan-only step
    .map((s) => ({
      stepIndex: s.stepIndex,
      title: s.title,
      sql: s.sql,
      chartType: s.chartType || "table",
      columns: s.columns,
      rows: s.rows,
      insight: s.insight,
      error: s.error,
    }));

  const stored: StoredAnalysis = {
    id: data.sessionId,
    question: data.question,
    plan: data.plan || [],
    steps: filteredSteps,
    summary: data.summary || null,
    stepCount: filteredSteps.length,
    timestamp: Date.now(),
    dataset: data.dataset,
  };
  await saveAnalysis(stored).catch(console.error);

  // Update server feed with full analysis results (fire-and-forget)
  fetch("/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: data.sessionId,
      question: data.question,
      route: "analyze",
      timestamp: Date.now(),
      summary: data.summary || null,
      stepCount: filteredSteps.length,
      dataset: data.dataset,
      resultData: {
        plan: data.plan || [],
        steps: filteredSteps.map((s) => ({
          ...s,
          rows: (s.rows || []).slice(0, 200),
        })),
        summary: data.summary || null,
      },
    }),
  }).catch(() => {});
}
