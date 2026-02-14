"use client";

import { useState, useCallback, useRef } from "react";
import { saveAnalysis, type StoredAnalysis } from "@/lib/queryStore";

const MAX_STEPS = 5;

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

export type AnalysisStatus = "idle" | "planning" | "running" | "complete" | "error" | "cancelled";

interface AnalysisState {
  sessionId: string | null;
  question: string | null;
  plan: string[] | null;
  steps: AnalysisStep[];
  summary: string | null;
  status: AnalysisStatus;
  error: string | null;
}

interface CompletedStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  resultSummary: string | null;
  insight: string | null;
  error: string | null;
}

export function useAnalysis() {
  const abortRef = useRef<AbortController | null>(null);
  const planRef = useRef<string[] | null>(null);

  const [state, setState] = useState<AnalysisState>({
    sessionId: null,
    question: null,
    plan: null,
    steps: [],
    summary: null,
    status: "idle",
    error: null,
  });

  const startAnalysis = useCallback(
    async (question: string, years?: number[] | null) => {
      if (!question.trim()) return;

      // Cancel any in-flight analysis
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const abortController = new AbortController();
      abortRef.current = abortController;

      const sessionId = crypto.randomUUID();
      planRef.current = null;

      setState({
        sessionId,
        question,
        plan: null,
        steps: [],
        summary: null,
        status: "planning",
        error: null,
      });

      try {
        const completedSteps: CompletedStep[] = [];

        for (let stepIndex = 0; stepIndex < MAX_STEPS; stepIndex++) {
          if (abortController.signal.aborted) {
            setState((prev) => ({ ...prev, status: "cancelled" }));
            return;
          }

          // Update status for current step
          setState((prev) => ({
            ...prev,
            status: stepIndex === 0 ? "planning" : "running",
            steps: [
              ...prev.steps,
              {
                stepIndex,
                title: "",
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

          // Call API — server now executes SQL and returns results
          const apiResponse = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question,
              years: years ?? null,
              sessionId,
              stepIndex,
              previousSteps: completedSteps,
            }),
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

          // Update plan on first step
          if (stepIndex === 0 && data.plan) {
            planRef.current = data.plan;
            setState((prev) => ({ ...prev, plan: data.plan }));
          }

          // If a step has cannotAnswer, treat it as completed with the explanation
          if (data.step?.cannotAnswer) {
            setState((prev) => ({
              ...prev,
              steps: prev.steps.map((s, i) =>
                i === stepIndex
                  ? { ...s, title: data.step.title || "Cannot answer", sql: null, status: "complete", insight: data.step.cannotAnswer }
                  : s
              ),
              ...(data.done ? { summary: data.summary || data.step.cannotAnswer, status: "complete" } : {}),
            }));

            completedSteps.push({
              stepIndex,
              title: data.step.title || "Cannot answer",
              sql: null,
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
              i === stepIndex
                ? {
                    ...s,
                    title: step.title || `Step ${stepIndex + 1}`,
                    sql: step.sql,
                    chartType: step.chartType || "table",
                    columns: stepColumns,
                    rows: stepRows,
                    status: stepError ? "error" : "complete",
                    error: stepError,
                    insight: step.insight || null,
                  }
                : s
            ),
          }));

          completedSteps.push({
            stepIndex,
            title: step.title || `Step ${stepIndex + 1}`,
            sql: step.sql,
            resultSummary: step.resultSummary || null,
            insight: step.insight || null,
            error: stepError,
          });

          // If done, set summary
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
        });
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
    []
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
    });
  }, []);

  const clearAnalysis = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({
      sessionId: null,
      question: null,
      plan: null,
      steps: [],
      summary: null,
      status: "idle",
      error: null,
    });
  }, []);

  return {
    ...state,
    startAnalysis,
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
}) {
  const stored: StoredAnalysis = {
    id: data.sessionId,
    question: data.question,
    plan: data.plan || [],
    steps: data.steps.map((s) => ({
      stepIndex: s.stepIndex,
      title: s.title,
      sql: s.sql,
      chartType: "table",
      columns: [],
      rows: [],
      insight: s.insight,
      error: s.error,
    })),
    summary: data.summary || null,
    stepCount: data.steps.length,
    timestamp: Date.now(),
  };
  await saveAnalysis(stored).catch(console.error);
}
