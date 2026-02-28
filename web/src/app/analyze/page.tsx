"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/useQuery";
import { useAnalysis, type PriorContext } from "@/hooks/useAnalysis";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { QueryInput, type QueryInputHandle } from "@/components/analyze/QueryInput";
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
const DATASETS = [
  { key: "medicaid" as const, label: "Medicaid" },
  { key: "brfss" as const, label: "BRFSS (beta)" },
];

type Dataset = "medicaid" | "brfss";
type Mode = "idle" | "query" | "analysis";

export default function AnalyzePage() {
  const {
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

  const analysis = useAnalysis();

  const [activeTab, setActiveTab] = useState<"query" | "feed">("query");
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [dataset, setDataset] = useState<Dataset>("medicaid");
  const [mode, setMode] = useState<Mode>("idle");
  const [priorContext, setPriorContext] = useState<PriorContext | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  // Use refs for stable callback references
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  useEffect(() => {
    const saved = window.localStorage.getItem("analyze:lastDataset");
    if (saved === "medicaid" || saved === "brfss") {
      setDataset(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("analyze:lastDataset", dataset);
  }, [dataset]);

  // Accumulate prior context when analysis completes (for follow-up/refine queries)
  useEffect(() => {
    if (analysis.status === "complete" && analysis.question && analysis.summary) {
      setPriorContext((prev) => ({
        history: [
          ...(prev?.history ?? []),
          {
            question: analysis.question!,
            summary: analysis.summary!,
            steps: analysis.steps.map((s) => ({ title: s.title, insight: s.insight })),
          },
        ],
      }));
    }
  }, [analysis.status, analysis.question, analysis.summary, analysis.steps]);

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
      setLastQuestion(question);

      if (submitMode === "analysis") {
        if (dataset === "brfss") {
          setMode("query");
          analysisRef.current.clearAnalysis();
          setPriorContext(null);
          await submitQuestion(question, years, dataset);
          setFeedRefreshKey((k) => k + 1);
          return;
        }
        setMode("analysis");
        clearResults();
        await analysisRef.current.startAnalysis(question, years, priorContext);
        setFeedRefreshKey((k) => k + 1);
      } else {
        setMode("query");
        analysisRef.current.clearAnalysis();
        setPriorContext(null);
        await submitQuestion(question, years, dataset);
        setFeedRefreshKey((k) => k + 1);
      }
    },
    [submitQuestion, selectedYears, clearResults, priorContext, dataset]
  );

  const queryInputRef = useRef<QueryInputHandle | null>(null);

  const handleNewAnalysis = useCallback(() => {
    analysisRef.current.clearAnalysis();
    clearResults();
    setPriorContext(null);
    setMode("idle");
  }, [clearResults]);

  const handleFeedSelect = useCallback(
    (item: StoredQuery | StoredAnalysis | null, question?: string) => {
      if (item === null && question) {
        // Server feed item — pre-fill question and switch to query tab
        setActiveTab("query");
        queryInputRef.current?.setQuestion(question);
        return;
      }
      if (!item) return;
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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-3">
                {DATASETS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setDataset(d.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                      dataset === d.key
                        ? "bg-accent text-white border-accent"
                        : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {dataset === "medicaid" ? "Analyze Spending" : "Analyze Population Health"}
              </h1>
              <p className="text-sm sm:text-base text-muted mt-1 sm:mt-2">
                {dataset === "medicaid"
                  ? "Ask questions about Medicaid provider spending in natural language"
                  : "Ask questions about BRFSS survey data in natural language (beta)"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 glass-card p-1 self-start sm:self-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
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

          {/* Feed tab */}
          {activeTab === "feed" && (
            <QueryFeed onSelect={handleFeedSelect} refreshKey={feedRefreshKey} />
          )}

          {/* Query tab */}
          {activeTab === "query" && (
            <div className="space-y-6">
              {/* Year filter */}
              {dataset === "medicaid" ? (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedYears(new Set())}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
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
                        "px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                        selectedYears.has(y)
                          ? "bg-accent text-white border-accent"
                          : "text-muted hover:text-white bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08]"
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 w-fit">
                  BRFSS beta currently uses the latest full-year dataset (2023).
                </div>
              )}

              <QueryInput
                ref={queryInputRef}
                onSubmit={handleSubmit}
                loading={loading}
                analysisRunning={analysisRunning}
                onCancelAnalysis={analysis.cancelAnalysis}
                followUpQuestion={priorContext?.history?.length ? priorContext.history[priorContext.history.length - 1].question : null}
                onNewAnalysis={handleNewAnalysis}
                dataset={dataset}
              />

              {/* Single query results */}
              {showQueryResults && (
                <>
                  {dataset === "brfss" && (
                    <div className="glass-card p-4 border-amber-500/30">
                      <p className="text-xs text-amber-300 font-medium mb-1">BRFSS beta caveats</p>
                      <p className="text-xs text-muted">
                        Self-reported cross-sectional survey data. Use results for directional insight, not causal claims.
                        Weighted estimates are preferred where possible.
                      </p>
                    </div>
                  )}

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
                        <ResultsTable columns={columns} rows={rows} title={lastQuestion || undefined} />
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
                        Generating and executing query...
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Deep analysis results */}
              {showAnalysisResults && (
                <AnalysisSteps
                  plan={analysis.plan}
                  planReasoning={analysis.planReasoning}
                  steps={analysis.steps}
                  summary={analysis.summary}
                  status={analysis.status}
                  error={analysis.error}
                  onRefine={(instruction) => {
                    const years = selectedYears.size > 0 ? Array.from(selectedYears).sort() : null;
                    setMode("analysis");
                    clearResults();
                    analysisRef.current.startAnalysis(instruction, years, priorContext);
                  }}
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
