"use client";

import { useState, useEffect, useCallback } from "react";

interface DuckDBState {
  ready: boolean;
  loading: boolean;
  error: string | null;
}

interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export function useDuckDB() {
  const [state, setState] = useState<DuckDBState>({
    ready: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { initDuckDB } = await import("@/lib/duckdb");
        await initDuckDB();
        if (!cancelled) {
          setState({ ready: true, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            ready: false,
            loading: false,
            error: err instanceof Error ? err.message : "Failed to initialize DuckDB",
          });
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const executeQuery = useCallback(
    async (sql: string): Promise<QueryResult> => {
      if (!state.ready) {
        throw new Error("DuckDB is not ready");
      }

      const { queryDuckDB } = await import("@/lib/duckdb");

      const timeoutMs = 60000;
      const result = await Promise.race([
        queryDuckDB(sql),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Query timed out after 60 seconds")), timeoutMs)
        ),
      ]);

      return result;
    },
    [state.ready]
  );

  return {
    ...state,
    executeQuery,
  };
}
