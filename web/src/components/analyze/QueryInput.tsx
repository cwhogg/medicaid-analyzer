"use client";

import { useState, FormEvent } from "react";
import { Search, Loader2, Layers, X } from "lucide-react";

const EXAMPLE_QUERIES = [
  "What are the top 10 HCPCS codes by total spending?",
  "Show monthly spending trends for 2024",
  "Which providers have the most unique beneficiaries?",
  "What is the average spending per claim by year?",
  "Top 5 procedure codes with the fastest spending growth",
];

interface QueryInputProps {
  onSubmit: (question: string, mode: "query" | "analysis") => void;
  loading: boolean;
  analysisRunning?: boolean;
  onCancelAnalysis?: () => void;
}

export function QueryInput({ onSubmit, loading, analysisRunning, onCancelAnalysis }: QueryInputProps) {
  const [question, setQuestion] = useState("");

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
      <form onSubmit={handleSubmit} className="relative">
        <div className="glass-card flex items-center gap-3 p-2 pr-3">
          <Search className="w-5 h-5 text-muted-dark ml-3 shrink-0" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about Medicaid spending..."
            disabled={busy}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-muted-dark py-2 text-sm"
            maxLength={500}
          />
          <div className="flex items-center gap-2 shrink-0">
            {analysisRunning ? (
              <button
                type="button"
                onClick={onCancelAnalysis}
                className="py-2 px-4 text-sm flex items-center gap-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            ) : (
              <>
                <button
                  type="submit"
                  disabled={!question.trim() || busy}
                  className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="py-2 px-4 text-sm flex items-center gap-2 rounded-lg border border-accent/50 text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Layers className="w-4 h-4" />
                  Deep Analysis
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuestion(q);
              if (!busy) onSubmit(q, "query");
            }}
            disabled={busy}
            className="text-xs text-muted hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
