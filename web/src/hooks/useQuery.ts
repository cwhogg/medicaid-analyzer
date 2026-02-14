"use client";

import { useState, useCallback } from "react";
import { useDuckDB } from "./useDuckDB";
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
  const { ready, loading: dbLoading, error: dbError, executeQuery } = useDuckDB();

  const [state, setState] = useState<QueryState>({
    sql: null,
    columns: [],
    rows: [],
    loading: false,
    error: null,
    chartType: "table",
  });

  const submitQuestion = useCallback(
    async (question: string) => {
      if (!ready) return;
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
        // Step 1: Get SQL from API
        const response = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        let { sql } = await response.json();

        setState((prev) => ({
          ...prev,
          sql,
        }));

        // Step 2: Execute SQL in DuckDB-WASM, with one retry on SQL errors
        let result;
        try {
          result = await executeQuery(sql);
        } catch (execErr) {
          const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
          const isSqlError = /binder error|parser error|catalog error|no such|not found|does not have/i.test(errMsg);
          if (!isSqlError) throw execErr;

          const retryResponse = await fetch("/api/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, failedSql: sql, sqlError: errMsg }),
          });

          if (!retryResponse.ok) {
            throw new Error(errMsg);
          }

          const retryData = await retryResponse.json();
          sql = retryData.sql;

          setState((prev) => ({
            ...prev,
            sql,
          }));

          result = await executeQuery(sql);
        }

        setState((prev) => ({
          ...prev,
          columns: result.columns,
          rows: result.rows,
          loading: false,
        }));

        // Save to IndexedDB
        const stored: StoredQuery = {
          id: crypto.randomUUID(),
          question,
          sql,
          chartType: "table",
          columns: result.columns,
          rows: result.rows,
          rowCount: result.rows.length,
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
    [ready, executeQuery]
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
    dbReady: ready,
    dbLoading,
    dbError,
    ...state,
    submitQuestion,
    setChartType,
    loadStoredQuery,
    clearResults,
  };
}
