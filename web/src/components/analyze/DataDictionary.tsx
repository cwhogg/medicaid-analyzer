"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronRight, Info } from "lucide-react";
import type { VariableGroup } from "@/lib/variableMeta";

interface DataDictionaryProps {
  groups?: VariableGroup[];
}

export function DataDictionary({ groups }: DataDictionaryProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const query = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!groups) return [];
    if (!query) return groups;

    return groups
      .map((group) => {
        const matchingVars = group.variables.filter(
          (v) =>
            v.name.toLowerCase().includes(query) ||
            v.description.toLowerCase().includes(query) ||
            (v.codes && v.codes.toLowerCase().includes(query)) ||
            (v.note && v.note.toLowerCase().includes(query))
        );
        if (matchingVars.length === 0) return null;
        return { ...group, variables: matchingVars };
      })
      .filter(Boolean) as VariableGroup[];
  }, [groups, query]);

  const totalVars = groups?.reduce((sum, g) => sum + g.variables.length, 0) ?? 0;
  const shownVars = filtered.reduce((sum, g) => sum + g.variables.length, 0);

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  if (!groups || groups.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-muted text-sm">No variable metadata available for this dataset.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search variables by name, description, or codes..."
          className="w-full pl-10 pr-4 py-2.5 rounded-sm bg-background border border-rule text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors font-subhead italic"
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted">
        {query
          ? `Showing ${shownVars} of ${totalVars} variables`
          : `${totalVars} variables across ${groups.length} categories`}
      </p>

      {/* Groups */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted text-sm">No variables match &ldquo;{search}&rdquo;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => {
            const isCollapsed = query ? false : collapsed.has(group.name);

            return (
              <div key={group.name} className="card overflow-hidden">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-background transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-foreground">{group.name}</span>
                  <span className="text-xs text-muted">({group.variables.length})</span>
                  {group.description && (
                    <span className="text-xs text-muted ml-2 hidden sm:inline truncate">
                      {group.description}
                    </span>
                  )}
                </button>

                {/* Variables */}
                {!isCollapsed && (
                  <div className="border-t border-rule-light">
                    {group.variables.map((v) => (
                      <div
                        key={v.name}
                        className="px-3 sm:px-4 py-2.5 border-b border-rule-light last:border-b-0 hover:bg-[#F5F5F0] transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
                          {/* Name + type */}
                          <div className="shrink-0 sm:min-w-[140px] flex items-center gap-1.5 flex-wrap">
                            <code className="text-xs font-mono text-accent">{v.name}</code>
                            {v.type && (
                              <span className="text-[10px] text-teal uppercase bg-emerald-50 px-1 py-0.5 rounded-sm">{v.type}</span>
                            )}
                            {v.note && (
                              <span className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                <Info className="w-2.5 h-2.5" />
                                {v.note}
                              </span>
                            )}
                          </div>

                          {/* Description + codes */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-body">{v.description}</p>
                            {v.codes && (
                              <p className="text-xs text-muted mt-0.5 font-mono break-all">{v.codes}</p>
                            )}
                          </div>

                          {/* Note badge — desktop only (shown inline on mobile) */}
                          {v.note && (
                            <span className="hidden sm:inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Info className="w-3 h-3" />
                              {v.note}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
