"use client";

import { useState, useCallback } from "react";
import { saveQuery, type StoredQuery } from "@/lib/queryStore";

interface QueryState {
  sql: string | null;
  columns: string[];
  rows: unknown[][];
  loading: boolean;
  error: string | null;
  chartType: "table" | "line" | "bar" | "pie";
}

export function useQuery() {
  const [state, setState] = useState<QueryState>({
    sql: null,
    columns: [],
    rows: [],
    loading: false,
    error: null,
    chartType: "table",
  });

  const submitQuestion = useCallback(
    async (question: string, years?: number[] | null, dataset: "medicaid" | "brfss" = "medicaid") => {
      if (!question.trim()) return;

      setState((prev) => ({
        ...prev,
        sql: null,
        columns: [],
        rows: [],
        loading: true,
        error: null,
        chartType: "table",
      }));

      try {
        const response = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, years: years ?? null, dataset }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const { sql, chartType, columns, rows } = await response.json();

        setState((prev) => ({
          ...prev,
          sql,
          chartType: "table",
          columns,
          rows,
          loading: false,
        }));

        // Save to IndexedDB
        const stored: StoredQuery = {
          id: crypto.randomUUID(),
          question,
          sql,
          chartType: chartType || "table",
          columns,
          rows,
          rowCount: rows.length,
          timestamp: Date.now(),
        };
        await saveQuery(stored).catch(console.error);
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : "An unexpected error occurred",
        }));
      }
    },
    []
  );

  const setChartType = useCallback((chartType: "table" | "line" | "bar" | "pie") => {
    setState((prev) => ({ ...prev, chartType }));
  }, []);

  const loadStoredQuery = useCallback((query: StoredQuery) => {
    setState({
      sql: query.sql,
      columns: query.columns,
      rows: query.rows,
      loading: false,
      error: null,
      chartType: "table",
    });
  }, []);

  const clearResults = useCallback(() => {
    setState({
      sql: null,
      columns: [],
      rows: [],
      loading: false,
      error: null,
      chartType: "table",
    });
  }, []);

  return {
    ...state,
    submitQuestion,
    setChartType,
    loadStoredQuery,
    clearResults,
  };
}
