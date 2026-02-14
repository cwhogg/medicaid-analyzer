"use client";

import { useState, useCallback, useRef } from "react";
import { useQuery } from "@/hooks/useQuery";
import { useDuckDB } from "@/hooks/useDuckDB";
import { useAnalysis } from "@/hooks/useAnalysis";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { QueryInput } from "@/components/analyze/QueryInput";
import { SQLDisplay } from "@/components/analyze/SQLDisplay";
import { ResultsTable } from "@/components/analyze/ResultsTable";
import { ResultsChart } from "@/components/analyze/ResultsChart";
import { QueryFeed } from "@/components/analyze/QueryFeed";
import { AnalysisSteps } from "@/components/analyze/AnalysisSteps";
import { Table, LineChart, BarChart3, PieChart, AlertCircle, Loader2, Search, History } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoredQuery, StoredAnalysis } from "@/lib/queryStore";

const VIEW_MODES = [
  { key: "table" as const, label: "Table", icon: Table },
  { key: "line" as const, label: "Line", icon: LineChart },
  { key: "bar" as const, label: "Bar", icon: BarChart3 },
  { key: "pie" as const, label: "Pie", icon: PieChart },
];

const TABS = [
  { key: "query" as const, label: "Query", icon: Search },
  { key: "feed" as const, label: "Feed", icon: History },
];

const ALL_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];

type Mode = "idle" | "query" | "analysis";

export default function AnalyzePage() {
  const {
    dbReady,
    dbError,
    sql,
    columns,
    rows,
    loading,
    error,
    chartType,
    submitQuestion,
    setChartType,
    loadStoredQuery,
    clearResults,
  } = useQuery();

  // Shared DuckDB instance for analysis — same singleton as useQuery's
  const { executeQuery } = useDuckDB();
  const analysis = useAnalysis(executeQuery);

  const [activeTab, setActiveTab] = useState<"query" | "feed">("query");
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("idle");

  // Use refs for stable callback references
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  const toggleYear = useCallback((year: number) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
      } else {
        next.add(year);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (question: string, submitMode: "query" | "analysis") => {
      const years = selectedYears.size > 0 ? Array.from(selectedYears).sort() : null;

      if (submitMode === "analysis") {
        setMode("analysis");
        clearResults();
        await analysisRef.current.startAnalysis(question, years);
        setFeedRefreshKey((k) => k + 1);
      } else {
        setMode("query");
        analysisRef.current.clearAnalysis();
        await submitQuestion(question, years);
        setFeedRefreshKey((k) => k + 1);
      }
    },
    [submitQuestion, selectedYears, clearResults]
  );

  const handleFeedSelect = useCallback(
    (item: StoredQuery | StoredAnalysis) => {
      if ("steps" in item) {
        analysisRef.current.loadStoredAnalysis(item);
        clearResults();
        setMode("analysis");
      } else {
        loadStoredQuery(item);
        analysisRef.current.clearAnalysis();
        setMode("query");
      }
      setActiveTab("query");
    },
    [loadStoredQuery, clearResults]
  );

  const analysisRunning = analysis.status === "planning" || analysis.status === "running";
  const showQueryResults = mode === "query" && (sql || rows.length > 0 || loading || error);
  const showAnalysisResults = mode === "analysis" && (analysis.steps.length > 0 || analysis.plan || analysis.status !== "idle");

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-24 pb-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white">Analyze Spending</h1>
              <p className="text-muted mt-2">
                Ask questions about Medicaid provider spending in natural language
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 glass-card p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    activeTab === tab.key
                      ? "bg-accent text-white"
                      : "text-muted hover:text-white"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {dbError && (
            <div className="glass-card p-4 mb-6 border-red-500/30 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm text-red-400 font-medium">Failed to initialize DuckDB</p>
                <p className="text-xs text-muted-dark mt-1">{dbError}</p>
              </div>
            </div>
          )}

          {/* Feed tab */}
          {activeTab === "feed" && (
            <QueryFeed onSelect={handleFeedSelect} refreshKey={feedRefreshKey} />
          )}

          {/* Query tab */}
          {activeTab === "query" && (
            <div className="space-y-6">
              {/* Year filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setSelectedYears(new Set())}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                    selectedYears.size === 0
                      ? "bg-accent text-white border-accent"
                      : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                  )}
                >
                  All
                </button>
                {ALL_YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => toggleYear(y)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      selectedYears.has(y)
                        ? "bg-accent text-white border-accent"
                        : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>

              <QueryInput
                onSubmit={handleSubmit}
                loading={loading}
                disabled={!dbReady}
                analysisRunning={analysisRunning}
                onCancelAnalysis={analysis.cancelAnalysis}
              />

              {/* Single query results */}
              {showQueryResults && (
                <>
                  {/* Error display */}
                  {error && (
                    <div className="glass-card p-4 border-red-500/30 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* SQL display */}
                  {sql && <SQLDisplay sql={sql} />}

                  {/* Results */}
                  {rows.length > 0 && (
                    <>
                      {/* View mode toggle */}
                      <div className="flex items-center gap-1 glass-card p-1 w-fit">
                        {VIEW_MODES.map((viewMode) => (
                          <button
                            key={viewMode.key}
                            onClick={() => setChartType(viewMode.key)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                              chartType === viewMode.key
                                ? "bg-accent text-white"
                                : "text-muted hover:text-white"
                            )}
                          >
                            <viewMode.icon className="w-3.5 h-3.5" />
                            {viewMode.label}
                          </button>
                        ))}
                      </div>

                      {chartType === "table" ? (
                        <ResultsTable columns={columns} rows={rows} />
                      ) : (
                        <ResultsChart
                          columns={columns}
                          rows={rows}
                          chartType={chartType}
                        />
                      )}
                    </>
                  )}

                  {/* Loading state */}
                  {loading && (
                    <div className="glass-card p-12 flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-accent animate-spin" />
                      <p className="text-sm text-muted">
                        {sql ? "Executing query..." : "Generating SQL..."}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Deep analysis results */}
              {showAnalysisResults && (
                <AnalysisSteps
                  plan={analysis.plan}
                  steps={analysis.steps}
                  summary={analysis.summary}
                  status={analysis.status}
                  error={analysis.error}
                />
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
