"use client";

import { useState, useCallback, useRef, FormEvent } from "react";
import { useAnalysis, type PriorContext } from "@/hooks/useAnalysis";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AnalysisSteps } from "@/components/analyze/AnalysisSteps";
import { ShareButton } from "@/components/analyze/ShareButton";
import { PipelineSteps } from "@/components/analyze/PipelineSteps";
import { Search, Loader2, X, Layers, CornerDownRight, RotateCcw } from "lucide-react";

const EXAMPLE_QUERIES = [
  { label: "Compare Medicaid vs Medicare on RPM", question: "Compare Medicaid and Medicare spending on remote patient monitoring codes" },
  { label: "Most expensive drugs", question: "What are the most expensive drugs in Medicare Part D?" },
  { label: "Obesity trends", question: "How has obesity prevalence changed over the past decade?" },
  { label: "Top billing NPIs across programs", question: "Which NPIs bill the most across Medicare Part B and Part D?" },
  { label: "Hospital hip replacement costs", question: "What does a hip replacement cost at different hospitals?" },
  { label: "Cardiologists by state", question: "How many cardiologists are in each state?" },
];

export default function UnifiedAnalyzePage() {
  const analysis = useAnalysis();
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;

  const [question, setQuestion] = useState("");
  const [priorContext, setPriorContext] = useState<PriorContext | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track when analysis completes to build prior context
  const lastCompleteRef = useRef<string | null>(null);
  if (
    analysis.status === "complete" &&
    analysis.question &&
    analysis.summary &&
    analysis.question !== lastCompleteRef.current
  ) {
    lastCompleteRef.current = analysis.question;
    // Build prior context chain
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

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!question.trim()) return;
      analysisRef.current.startAnalysis(question.trim(), null, priorContext, "auto");
    },
    [question, priorContext]
  );

  const handleExampleClick = useCallback((q: string) => {
    setQuestion(q);
    inputRef.current?.focus();
  }, []);

  const handleNewAnalysis = useCallback(() => {
    analysisRef.current.clearAnalysis();
    setPriorContext(null);
    lastCompleteRef.current = null;
    setQuestion("");
  }, []);

  const handleClarificationResponse = useCallback((answer: string) => {
    analysisRef.current.respondToClarification(answer);
  }, []);

  const analysisRunning = analysis.status === "routing" || analysis.status === "planning" || analysis.status === "running";
  const showPipeline = analysis.conceptExtraction || analysis.status === "routing";
  const showAnalysisResults = analysis.steps.length > 0 || analysis.plan || (analysis.status !== "idle" && analysis.status !== "routing" && analysis.status !== "clarifying");
  const followUpQuestion = priorContext?.history?.length ? priorContext.history[priorContext.history.length - 1].question : null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen pb-12">
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          {/* Page header */}
          <div className="mb-6">
            <h1 className="font-headline text-[1.875rem] font-bold text-foreground leading-tight">
              Analyze Public Health Data
            </h1>
            <p className="font-serif text-[0.9375rem] text-body mt-1 leading-relaxed max-w-[560px]">
              Ask a question about any dataset. The system will automatically detect which data sources to use.
            </p>
          </div>

          <hr className="rule mb-6" />

          <div className="space-y-6">
            {/* Example query chips */}
            {analysis.status === "idle" && (
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((eq) => (
                  <button
                    key={eq.label}
                    onClick={() => handleExampleClick(eq.question)}
                    className="px-3 py-1.5 rounded-sm text-xs font-medium text-teal hover:text-teal-hover border border-rule hover:border-teal transition-colors"
                  >
                    {eq.label}
                  </button>
                ))}
              </div>
            )}

            {/* Query input */}
            <div>
              {followUpQuestion && analysis.status !== "idle" ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <CornerDownRight className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-muted shrink-0">Refined from:</span>
                    <span className="text-foreground font-medium truncate">{followUpQuestion}</span>
                  </div>
                  <button
                    onClick={handleNewAnalysis}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm text-muted hover:text-foreground bg-surface border border-rule hover:border-muted transition-colors shrink-0 self-end sm:self-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Start Fresh
                  </button>
                </div>
              ) : (
                <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-accent mb-3">
                  Ask a question about public health data
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="card p-4 sm:p-5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Search className="w-5 h-5 text-muted shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder={followUpQuestion
                        ? "Ask a follow-up question..."
                        : "What would you like to explore?"}
                      disabled={analysisRunning}
                      className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted py-2.5 text-sm font-subhead italic min-w-0"
                      maxLength={1000}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-2 sm:justify-end">
                    {analysisRunning ? (
                      <button
                        type="button"
                        onClick={analysis.cancelAnalysis}
                        className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!question.trim() || analysisRunning}
                        className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-sm border border-accent text-accent hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold uppercase tracking-wider"
                      >
                        {analysisRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Layers className="w-4 h-4" />
                            Analyze
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>

            {/* Pipeline visualization (concept extraction + dataset selection) */}
            {showPipeline && (
              <PipelineSteps
                status={analysis.status}
                conceptExtraction={analysis.conceptExtraction}
                datasetSelection={analysis.datasetSelection}
                detectedDatasets={analysis.detectedDatasets}
              />
            )}

            {/* Clarification UI */}
            {analysis.status === "clarifying" && analysis.clarification && (
              <div className="card p-5 border-l-[3px] border-l-amber-500">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {analysis.clarification.question}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.clarification.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleClarificationResponse(option)}
                      className="px-4 py-2 rounded-sm text-sm font-medium border border-rule hover:border-accent hover:text-accent transition-colors"
                    >
                      {option}
                    </button>
                  ))}
                  <button
                    onClick={() => handleClarificationResponse("both")}
                    className="px-4 py-2 rounded-sm text-sm font-medium border border-accent text-accent hover:bg-red-50 transition-colors"
                  >
                    Both / All
                  </button>
                </div>
              </div>
            )}

            {/* Analysis results (plan + steps + summary) */}
            {showAnalysisResults && (
              <>
                <AnalysisSteps
                  plan={analysis.plan}
                  planReasoning={analysis.planReasoning}
                  steps={analysis.steps}
                  summary={analysis.summary}
                  status={analysis.status}
                  error={analysis.error}
                  onRefine={(instruction) => {
                    analysisRef.current.startAnalysis(instruction, null, priorContext, "auto");
                  }}
                />

                {/* Share button for completed analyses */}
                {analysis.status === "complete" && analysis.question && (
                  <ShareButton
                    payload={{
                      question: analysis.question,
                      dataset: "auto",
                      type: "analysis",
                      plan: analysis.plan || undefined,
                      steps: analysis.steps.map((s) => ({
                        stepIndex: s.stepIndex,
                        title: s.title,
                        sql: s.sql,
                        chartType: s.chartType,
                        columns: s.columns,
                        rows: s.rows,
                        insight: s.insight,
                        error: s.error,
                      })),
                      summary: analysis.summary,
                      timestamp: Date.now(),
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
