"use client";

import { useState } from "react";
import { Copy, Check, Code, ChevronRight } from "lucide-react";

interface SQLDisplayProps {
  sql: string;
}

export function SQLDisplay({ sql }: SQLDisplayProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-muted">
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
          <Code className="w-4 h-4" />
          Generated SQL
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </button>
      {open && (
        <pre className="px-4 pb-4 pt-2 text-sm font-mono text-muted overflow-x-auto leading-relaxed border-t border-white/[0.08]">
          <code>{sql}</code>
        </pre>
      )}
    </div>
  );
}
