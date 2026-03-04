"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@/hooks/useQuery";
import { useAnalysis, type PriorContext } from "@/hooks/useAnalysis";
import { getDataset } from "@/lib/datasets/index";
import type { DatasetConfig } from "@/lib/datasets";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { QueryInput, type QueryInputHandle } from "@/components/analyze/QueryInput";
import { SQLDisplay } from "@/components/analyze/SQLDisplay";
import { ResultsTable } from "@/components/analyze/ResultsTable";
import { ResultsChart } from "@/components/analyze/ResultsChart";
import { QueryFeed } from "@/components/analyze/QueryFeed";
import { AnalysisSteps } from "@/components/analyze/AnalysisSteps";
import { Table, LineChart, BarChart3, PieChart, AlertCircle, Loader2, Search, History, BookOpen } from "lucide-react";
import { DataDictionary } from "@/components/analyze/DataDictionary";
import { cn } from "@/lib/utils";
import type { StoredQuery, StoredAnalysis } from "@/lib/queryStore";

const VIEW_MODES = [
  { key: "table" as const, label: "Table", icon: Table },
  { key: "line" as const, label: "Line", icon: LineChart },
  { key: "bar" as const, label: "Bar", icon: BarChart3 },
  { key: "pie" as const, label: "Pie", icon: PieChart },
];

// TODO: Set to true to re-enable the Feed tab
const SHOW_FEED_TAB = false;

const TABS = [
  { key: "query" as const, label: "Query", icon: Search },
  ...(SHOW_FEED_TAB ? [{ key: "feed" as const, label: "Feed", icon: History }] : []),
  { key: "data" as const, label: "Data", icon: BookOpen },
] as const;

type Mode = "idle" | "query" | "analysis";

interface DatasetAnalyzePageProps {
  datasetKey: string;
}

export default function DatasetAnalyzePage({ datasetKey }: DatasetAnalyzePageProps) {
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

  const [activeTab, setActiveTab] = useState<"query" | "feed" | "data">("query");
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<Mode>("idle");
  const [priorContext, setPriorContext] = useState<PriorContext | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const config: DatasetConfig = getDataset(datasetKey);

  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

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
        if (!config.deepAnalysisSupported) {
          setMode("query");
          analysisRef.current.clearAnalysis();
          setPriorContext(null);
          await submitQuestion(question, years, datasetKey);
          setFeedRefreshKey((k) => k + 1);
          return;
        }
        setMode("analysis");
        clearResults();
        await analysisRef.current.startAnalysis(question, years, priorContext, datasetKey);
        setFeedRefreshKey((k) => k + 1);
      } else {
        setMode("query");
        analysisRef.current.clearAnalysis();
        setPriorContext(null);
        await submitQuestion(question, years, datasetKey);
        setFeedRefreshKey((k) => k + 1);
      }
    },
    [submitQuestion, selectedYears, clearResults, priorContext, datasetKey, config.deepAnalysisSupported]
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
      <main className="min-h-screen pb-12">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-accent mb-1">
                {datasetKey.toUpperCase()}
              </div>
              <h1 className="font-headline text-[1.875rem] font-bold text-foreground leading-tight">
                {config.pageTitle}
              </h1>
              <p className="font-serif text-[0.9375rem] text-body mt-1 leading-relaxed max-w-[560px]">
                {config.pageSubtitle}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-0 border-b border-rule-light self-start sm:self-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-medium transition-colors border-b-2 -mb-px",
                    activeTab === tab.key
                      ? "text-foreground border-accent font-semibold"
                      : "text-muted border-transparent hover:text-foreground"
                  )}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="rule mb-6" />

          {/* Feed tab */}
          {activeTab === "feed" && (
            <QueryFeed onSelect={handleFeedSelect} refreshKey={feedRefreshKey} dataset={datasetKey} />
          )}

          {/* Data tab */}
          {activeTab === "data" && (
            <DataDictionary groups={config.variableGroups} />
          )}

          {/* Query tab */}
          {activeTab === "query" && (
            <div className="space-y-6">
              {/* Year filter */}
              {config.yearFilter ? (
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedYears(new Set())}
                    className={cn(
                      "px-3 py-2 rounded-sm text-xs font-medium transition-colors border",
                      selectedYears.size === 0
                        ? "bg-accent text-white border-accent"
                        : "text-muted hover:text-foreground bg-surface border-rule hover:border-muted"
                    )}
                  >
                    All
                  </button>
                  {config.yearFilter.years.map((y) => (
                    <button
                      key={y}
                      onClick={() => toggleYear(y)}
                      className={cn(
                        "px-3 py-2 rounded-sm text-xs font-medium transition-colors border",
                        selectedYears.has(y)
                          ? "bg-accent text-white border-accent"
                          : "text-muted hover:text-foreground bg-surface border-rule hover:border-muted"
                      )}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Example query chips */}
              {config.exampleQueries && config.exampleQueries.length > 0 && mode === "idle" && (
                <div className="flex flex-wrap gap-2">
                  {config.exampleQueries.map((eq) => (
                    <button
                      key={eq.label}
                      onClick={() => {
                        queryInputRef.current?.setQuestion(eq.question);
                      }}
                      className="px-3 py-1.5 rounded-sm text-xs font-medium text-teal hover:text-teal-hover border border-rule hover:border-teal transition-colors"
                    >
                      {eq.label}
                    </button>
                  ))}
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
                inputHeading={config.inputHeading}
                inputPlaceholder={config.inputPlaceholder}
                deepAnalysisSupported={config.deepAnalysisSupported}
                deepAnalysisDisabledReason={config.deepAnalysisDisabledReason}
              />

              {/* Single query results */}
              {showQueryResults && (
                <>
                  {config.resultCaveat && (
                    <div className={`card p-4 ${config.resultCaveat.borderColor}`}>
                      <p className={`text-xs font-medium mb-1 ${config.resultCaveat.titleColor}`}>{config.resultCaveat.title}</p>
                      <p className="text-xs text-muted">
                        {config.resultCaveat.text}
                      </p>
                    </div>
                  )}

                  {/* Error display */}
                  {error && (
                    <div className="card p-4 border-red-300 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* SQL display */}
                  {sql && <SQLDisplay sql={sql} />}

                  {/* Results */}
                  {rows.length > 0 && (
                    <>
                      {/* View mode toggle */}
                      <div className="flex items-center gap-0 border-b border-rule-light w-fit">
                        {VIEW_MODES.map((viewMode) => (
                          <button
                            key={viewMode.key}
                            onClick={() => setChartType(viewMode.key)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
                              chartType === viewMode.key
                                ? "text-foreground border-accent font-semibold"
                                : "text-muted border-transparent hover:text-foreground"
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
                    <div className="card p-12 flex flex-col items-center gap-3">
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
                    analysisRef.current.startAnalysis(instruction, years, priorContext, datasetKey);
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
