"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { formatDateCell } from "@/lib/format";

interface ResultsTableProps {
  columns: string[];
  rows: unknown[][];
}

function isYearOrIdColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /^year$|_year$|^month$|_month$|^date$|_date$|npi|code|_id$|^id$|zip/.test(lower);
}

function formatCell(value: unknown, colName?: string): string {
  if (value === null || value === undefined) return "—";
  // Try date formatting first for string values
  const dateFormatted = formatDateCell(value, colName);
  if (dateFormatted) return dateFormatted;
  if (typeof value === "number") {
    // Don't comma-format years, IDs, codes, or NPI numbers
    if (colName && isYearOrIdColumn(colName)) return String(value);
    if (colName && /paid|spending|cost|amount|payment|charge|price/i.test(colName)) {
      return "$" + Math.round(value).toLocaleString();
    }
    if (Number.isInteger(value)) return value.toLocaleString();
    return Math.round(value).toLocaleString();
  }
  if (typeof value === "bigint") {
    if (colName && isYearOrIdColumn(colName)) return String(value);
    return value.toLocaleString();
  }
  return String(value);
}

function downloadCSV(columns: string[], rows: unknown[][]) {
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = columns.map(escape).join(",");
  const body = rows.map((row) => row.map(escape).join(",")).join("\n");
  const csv = header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medicaid-data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({ columns, rows }: ResultsTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let cmp = 0;
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const handleSort = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(colIndex);
      setSortDir("asc");
    }
  };

  // Find NPI column index for linking provider names
  const npiColIndex = useMemo(
    () => columns.findIndex((c) => c.toLowerCase() === "billing_npi"),
    [columns]
  );

  if (!rows.length) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-3 sm:px-4 py-2 border-b border-white/[0.08] flex items-center justify-between">
        <span className="text-sm text-muted">
          {rows.length.toLocaleString()} row{rows.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => downloadCSV(columns, sortedRows)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
          title="Download as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CSV</span>
        </button>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b border-white/[0.08]">
              {columns.map((col, i) => (
                <th
                  key={col}
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-muted-dark uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none"
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === i ? (
                      sortDir === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
              >
                {row.map((cell, j) => {
                  const colName = columns[j].toLowerCase();
                  const npi = npiColIndex !== -1 ? row[npiColIndex] : null;

                  return (
                    <td
                      key={j}
                      className="px-2 sm:px-4 py-2 sm:py-2.5 text-muted font-mono text-xs whitespace-nowrap"
                    >
                      {colName === "billing_npi" && cell ? (
                        <a
                          href={`https://npiregistry.cms.hhs.gov/provider-view/${cell}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {formatCell(cell, columns[j])}
                        </a>
                      ) : colName === "provider_name" && cell && npi ? (
                        <Link
                          href={`/provider/${npi}`}
                          className="text-accent hover:underline"
                        >
                          {formatCell(cell, columns[j])}
                        </Link>
                      ) : (
                        formatCell(cell, columns[j])
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
