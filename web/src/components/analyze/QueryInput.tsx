"use client";

import { useState, forwardRef, useImperativeHandle, FormEvent } from "react";
import { Search, Loader2, Layers, X } from "lucide-react";

interface QueryInputProps {
  onSubmit: (question: string, mode: "query" | "analysis") => void;
  loading: boolean;
  analysisRunning?: boolean;
  onCancelAnalysis?: () => void;
}

export interface QueryInputHandle {
  setQuestion: (q: string) => void;
}

export const QueryInput = forwardRef<QueryInputHandle, QueryInputProps>(function QueryInput({ onSubmit, loading, analysisRunning, onCancelAnalysis }, ref) {
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
      <h2 className="text-lg font-semibold text-white mb-3">Ask a question about Medicaid spending</h2>
      <form onSubmit={handleSubmit}>
        <div className="glass-card p-2 sm:pr-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <Search className="w-5 h-5 text-muted-dark ml-2 sm:ml-3 shrink-0" />
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What are the top 10 services by total spending?"
              disabled={busy}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-muted-dark py-2.5 text-sm min-w-0"
              maxLength={500}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 sm:mt-0 sm:justify-end">
            {analysisRunning ? (
              <button
                type="button"
                onClick={onCancelAnalysis}
                className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
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
                  disabled={!question.trim() || busy}
                  className="py-2.5 px-4 text-sm flex items-center justify-center gap-2 rounded-lg border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
