"use client";

import { useState, useCallback, useRef } from "react";
import { saveAnalysis, type StoredAnalysis } from "@/lib/queryStore";

const MAX_STEPS = 5;
const MAX_SUMMARY_ROWS = 20;

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

type ExecuteQueryFn = (sql: string) => Promise<{ columns: string[]; rows: unknown[][] }>;

function summarizeResults(columns: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(`Columns: ${columns.join(", ")}`);
  lines.push(`Row count: ${rows.length}`);

  // Show first N rows
  const preview = rows.slice(0, MAX_SUMMARY_ROWS);
  for (const row of preview) {
    const cells = row.map((cell, i) => `${columns[i]}=${cell}`);
    lines.push(cells.join(", "));
  }

  if (rows.length > MAX_SUMMARY_ROWS) {
    lines.push(`... and ${rows.length - MAX_SUMMARY_ROWS} more rows`);
  }

  // Numeric column stats
  for (let i = 0; i < columns.length; i++) {
    const numericVals = rows
      .map((r) => r[i])
      .filter((v): v is number => typeof v === "number");
    if (numericVals.length > 0) {
      const min = Math.min(...numericVals);
      const max = Math.max(...numericVals);
      const sum = numericVals.reduce((a, b) => a + b, 0);
      const avg = sum / numericVals.length;
      lines.push(`${columns[i]} stats: min=${min}, max=${max}, avg=${Math.round(avg)}, sum=${Math.round(sum)}`);
    }
  }

  return lines.join("\n");
}

export function useAnalysis(executeQuery: ExecuteQueryFn) {
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
        const completedSteps: {
          stepIndex: number;
          title: string;
          sql: string | null;
          resultSummary: string | null;
          insight: string | null;
          error: string | null;
        }[] = [];

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

          // Call API
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

          // If done with just a summary (no more SQL)
          if (data.done && !data.step?.sql) {
            setState((prev) => ({
              ...prev,
              summary: data.summary || null,
              status: "complete",
              // Remove the pending step we added
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

          // Update step with title and SQL
          setState((prev) => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
              i === stepIndex
                ? { ...s, title: step.title || `Step ${stepIndex + 1}`, sql: step.sql, chartType: step.chartType || "table", status: step.sql ? "executing" : "complete", insight: step.insight || null }
                : s
            ),
          }));

          // Execute SQL if present
          let resultSummary: string | null = null;
          let stepError: string | null = null;
          let columns: string[] = [];
          let rows: unknown[][] = [];

          if (step.sql) {
            try {
              const result = await executeQuery(step.sql);
              columns = result.columns;
              rows = result.rows;
              resultSummary = summarizeResults(columns, rows);
            } catch (execErr) {
              const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
              const isSqlError = /binder error|parser error|catalog error|not implemented|no such|not found|does not have/i.test(errMsg);

              if (isSqlError) {
                // One retry — ask Claude to fix the SQL
                try {
                  const retryResponse = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      question,
                      years: years ?? null,
                      sessionId,
                      stepIndex,
                      previousSteps: completedSteps,
                      failedSql: step.sql,
                      sqlError: errMsg,
                    }),
                    signal: abortController.signal,
                  });

                  if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    if (retryData.step?.sql) {
                      const fixedSql = retryData.step.sql;
                      setState((prev) => ({
                        ...prev,
                        steps: prev.steps.map((s, i) =>
                          i === stepIndex ? { ...s, sql: fixedSql } : s
                        ),
                      }));

                      const retryResult = await executeQuery(fixedSql);
                      columns = retryResult.columns;
                      rows = retryResult.rows;
                      resultSummary = summarizeResults(columns, rows);
                    } else {
                      stepError = errMsg;
                    }
                  } else {
                    stepError = errMsg;
                  }
                } catch {
                  stepError = errMsg;
                }
              } else {
                stepError = errMsg;
              }
            }
          }

          // Update step as complete or error
          setState((prev) => ({
            ...prev,
            steps: prev.steps.map((s, i) =>
              i === stepIndex
                ? {
                    ...s,
                    columns,
                    rows,
                    status: stepError ? "error" : "complete",
                    error: stepError,
                    insight: step.insight || s.insight,
                  }
                : s
            ),
          }));

          completedSteps.push({
            stepIndex,
            title: step.title || `Step ${stepIndex + 1}`,
            sql: step.sql,
            resultSummary,
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

        // If we reached max steps without "done", mark as complete
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
    [executeQuery]
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
  steps: {
    stepIndex: number;
    title: string;
    sql: string | null;
    resultSummary: string | null;
    insight: string | null;
    error: string | null;
  }[];
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
