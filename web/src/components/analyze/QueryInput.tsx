"use client";

import { useState, FormEvent } from "react";
import { Search, Loader2 } from "lucide-react";

const EXAMPLE_QUERIES = [
  "What are the top 10 HCPCS codes by total spending?",
  "Show monthly spending trends for 2024",
  "Which providers have the most unique beneficiaries?",
  "What is the average spending per claim by year?",
  "Top 5 procedure codes with the fastest spending growth",
];

interface QueryInputProps {
  onSubmit: (question: string) => void;
  loading: boolean;
  disabled: boolean;
}

export function QueryInput({ onSubmit, loading, disabled }: QueryInputProps) {
  const [question, setQuestion] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading || disabled) return;
    onSubmit(question.trim());
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="relative">
        <div className="glass-card flex items-center gap-3 p-2 pr-3">
          <Search className="w-5 h-5 text-muted-dark ml-3 shrink-0" />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={disabled ? "Initializing DuckDB..." : "Ask a question about Medicaid spending..."}
            disabled={disabled || loading}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-muted-dark py-2 text-sm"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!question.trim() || loading || disabled}
            className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              "Query"
            )}
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuestion(q);
              if (!loading && !disabled) onSubmit(q);
            }}
            disabled={loading || disabled}
            className="text-xs text-muted hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
