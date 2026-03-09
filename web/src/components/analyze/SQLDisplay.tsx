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
    <div className="border border-rule rounded-sm overflow-hidden">
      <div className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-background transition-colors">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-[0.8125rem] font-semibold text-body"
        >
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          />
          <Code className="w-4 h-4" />
          Generated SQL
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors border border-rule px-2 py-1 rounded-sm"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      {open && (
        <pre className="px-4 pb-4 pt-2 text-[0.8125rem] font-mono text-[#44403C] overflow-x-auto leading-relaxed border-t border-rule-light" style={{ background: "#F5F5F0" }}>
          <code>{sql}</code>
        </pre>
      )}
    </div>
  );
}
