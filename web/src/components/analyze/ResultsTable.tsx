"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { formatDateCell } from "@/lib/format";

interface ResultsTableProps {
  columns: string[];
  rows: unknown[][];
  title?: string;
}

function isYearOrIdColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /^year$|_year$|^month$|_month$|^date$|_date$|npi|code|_id$|^id$|zip/.test(lower);
}

function isDecimalColumn(colName: string): boolean {
  const lower = colName.toLowerCase();
  return /avg|mean|average|rate|pct|percent|prevalence|ratio|proportion|per_/.test(lower);
}

function formatCell(value: unknown, colName?: string): string {
  if (value === null || value === undefined) return "\u2014";
  const dateFormatted = formatDateCell(value, colName);
  if (dateFormatted) return dateFormatted;
  if (typeof value === "number") {
    if (colName && isYearOrIdColumn(colName)) return String(value);
    if (colName && /paid|spending|cost|amount|payment|charge|price/i.test(colName)) {
      return "$" + Math.round(value).toLocaleString();
    }
    if (colName && isDecimalColumn(colName)) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  if (typeof value === "bigint") {
    if (colName && isYearOrIdColumn(colName)) return String(value);
    return value.toLocaleString();
  }
  return String(value);
}

function toFilename(title?: string): string {
  if (!title) return "medicaid-data.csv";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return (slug || "medicaid-data") + ".csv";
}

function downloadCSV(columns: string[], rows: unknown[][], title?: string) {
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
  a.download = toFilename(title);
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({ columns, rows, title }: ResultsTableProps) {
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

  const npiColIndex = useMemo(
    () => columns.findIndex((c) => c.toLowerCase() === "billing_npi"),
    [columns]
  );

  if (!rows.length) return null;

  return (
    <div className="border border-rule rounded-sm overflow-hidden">
      <div className="px-3 sm:px-4 py-2 flex items-center justify-between">
        <span className="text-[0.8125rem] text-muted font-medium">
          {rows.length.toLocaleString()} row{rows.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => downloadCSV(columns, sortedRows, title)}
          className="flex items-center gap-1.5 text-xs text-body hover:text-foreground transition-colors border border-rule px-2 py-1 rounded-sm font-semibold"
          title="Download as CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">CSV</span>
        </button>
      </div>
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm" style={{ fontFeatureSettings: "'tnum' 1" }}>
          <thead className="sticky top-0 bg-surface">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col}
                  className="px-2 sm:px-4 py-2 sm:py-2.5 text-left text-[0.6875rem] font-bold text-body uppercase tracking-[0.1em] cursor-pointer hover:text-foreground transition-colors select-none whitespace-nowrap border-t-2 border-b border-foreground"
                >
                  <div className="flex items-center gap-1" onClick={() => handleSort(i)}>
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
                className="border-b border-rule-light hover:bg-[#F5F5F0] transition-colors"
              >
                {row.map((cell, j) => {
                  const colName = columns[j].toLowerCase();
                  const npi = npiColIndex !== -1 ? row[npiColIndex] : null;

                  return (
                    <td
                      key={j}
                      className="px-2 sm:px-4 py-2 sm:py-2.5 text-foreground font-mono text-xs whitespace-nowrap"
                    >
                      {colName === "billing_npi" && cell ? (
                        <a
                          href={`https://npiregistry.cms.hhs.gov/provider-view/${cell}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal hover:underline"
                        >
                          {formatCell(cell, columns[j])}
                        </a>
                      ) : colName === "provider_name" && cell && npi ? (
                        <Link
                          href={`/provider/${npi}`}
                          className="text-teal hover:underline"
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
