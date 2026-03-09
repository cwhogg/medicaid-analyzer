"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface User {
  ip: string;
  city: string | null;
  count: number;
  firstSeen: number;
  lastSeen: number;
  activeDays: number;
}

type SortKey = "count" | "firstSeen" | "lastSeen" | "activeDays";

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function UsersPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!key) {
      setError("not_found");
      return;
    }
    try {
      const res = await fetch(`/api/admin/users?key=${encodeURIComponent(key)}`);
      if (res.status === 404) {
        setError("not_found");
        return;
      }
      if (!res.ok) {
        setError("Failed to fetch users");
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch {
      setError("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (newKey: SortKey) => {
    if (sortKey === newKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(newKey);
      setSortAsc(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    const mul = sortAsc ? 1 : -1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  if (error === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted">Not found</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted">Loading users...</div>
      </div>
    );
  }

  const sortIndicator = (k: SortKey) =>
    sortKey === k ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <a
          href={`/admin?key=${encodeURIComponent(key || "")}`}
          className="text-teal hover:underline text-sm"
        >
          &larr; Dashboard
        </a>
        <h1 className="text-2xl font-headline font-bold">Top Users</h1>
        <span className="text-sm text-muted">({users.length} users)</span>
      </div>

      <div className="card p-4">
        <div className="relative">
          <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 pr-4">#</th>
              <th className="pb-2 pr-4">IP (masked)</th>
              <th className="pb-2 pr-4">Location</th>
              <th
                className="pb-2 pr-4 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("count")}
              >
                Requests{sortIndicator("count")}
              </th>
              <th
                className="pb-2 pr-4 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("firstSeen")}
              >
                First Seen{sortIndicator("firstSeen")}
              </th>
              <th
                className="pb-2 pr-4 cursor-pointer hover:text-foreground"
                onClick={() => handleSort("lastSeen")}
              >
                Last Seen{sortIndicator("lastSeen")}
              </th>
              <th
                className="pb-2 text-right cursor-pointer hover:text-foreground"
                onClick={() => handleSort("activeDays")}
              >
                Active Days{sortIndicator("activeDays")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user, i) => (
              <tr key={i} className="border-t border-rule-light">
                <td className="py-2 pr-4 text-muted font-mono text-xs">{i + 1}</td>
                <td className="py-2 pr-4 font-mono text-xs">{user.ip}</td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {user.city || <span className="text-muted">—</span>}
                </td>
                <td className="py-2 pr-4 text-right font-mono font-semibold">
                  {formatNumber(user.count)}
                </td>
                <td className="py-2 pr-4 text-xs text-muted">{formatDate(user.firstSeen)}</td>
                <td className="py-2 pr-4 text-xs text-muted">{formatDate(user.lastSeen)}</td>
                <td className="py-2 text-right font-mono">{user.activeDays}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted">
                  No user data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted">Loading...</div>
        </div>
      }
    >
      <UsersPage />
    </Suspense>
  );
}
