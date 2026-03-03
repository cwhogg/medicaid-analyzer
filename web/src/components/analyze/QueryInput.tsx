"use client";

import { useState, forwardRef, useImperativeHandle, FormEvent } from "react";
import { Search, Loader2, Layers, X, CornerDownRight, RotateCcw } from "lucide-react";

interface QueryInputProps {
  onSubmit: (question: string, mode: "query" | "analysis") => void;
  loading: boolean;
  analysisRunning?: boolean;
  onCancelAnalysis?: () => void;
  followUpQuestion?: string | null;
  onNewAnalysis?: () => void;
  inputHeading: string;
  inputPlaceholder: string;
  deepAnalysisSupported: boolean;
  deepAnalysisDisabledReason?: string;
}

export interface QueryInputHandle {
  setQuestion: (q: string) => void;
}

export const QueryInput = forwardRef<QueryInputHandle, QueryInputProps>(function QueryInput({ onSubmit, loading, analysisRunning, onCancelAnalysis, followUpQuestion, onNewAnalysis, inputHeading, inputPlaceholder, deepAnalysisSupported, deepAnalysisDisabledReason }, ref) {
  const [question, setQuestion] = useState("");

  useImperativeHandle(ref, () => ({
    setQuestion: (q: string) => setQuestion(q),
  }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading || analysisRunning) return;
    onSubmit(question.trim(), "query");
  };

  const handleDeepAnalysis = () => {
    if (!question.trim() || loading || analysisRunning) return;
    onSubmit(question.trim(), "analysis");
  };

  const busy = loading || analysisRunning;

  return (
    <div>
      {followUpQuestion ? (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm">
            <CornerDownRight className="w-4 h-4 text-accent shrink-0" />
            <span className="text-muted">Refined from:</span>
            <span className="text-foreground font-medium truncate max-w-[300px] sm:max-w-[400px]">{followUpQuestion}</span>
          </div>
          <button
            onClick={onNewAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm text-muted hover:text-foreground bg-surface border border-rule hover:border-muted transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Start Fresh
          </button>
        </div>
      ) : (
        <div className="text-[0.6875rem] font-bold tracking-[0.14em] uppercase text-accent mb-3">
          {inputHeading}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Search className="w-5 h-5 text-muted shrink-0" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={followUpQuestion
                ? "Ask a follow-up question..."
                : inputPlaceholder}
              disabled={busy}
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted py-2.5 text-sm font-subhead italic min-w-0"
              maxLength={500}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 sm:mt-2 sm:justify-end">
            {analysisRunning ? (
              <button
                type="button"
                onClick={onCancelAnalysis}
                className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={!question.trim() || busy}
                  className="btn-primary py-2.5 px-4 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    "Simple Query"
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDeepAnalysis}
                  disabled={!question.trim() || busy || !deepAnalysisSupported}
                  className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-sm border border-accent text-accent hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold uppercase tracking-wider"
                  title={!deepAnalysisSupported ? deepAnalysisDisabledReason : undefined}
                >
                  <Layers className="w-4 h-4" />
                  Deep Analysis
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
});
