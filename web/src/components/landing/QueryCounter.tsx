"use client";

import { useEffect, useState } from "react";

export function QueryCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.totalQueries > 0) setCount(data.totalQueries);
      })
      .catch(() => {});
  }, []);

  if (count === null) return null;

  return (
    <p className="text-[0.8125rem] text-muted">
      {count.toLocaleString()} questions answered so far
    </p>
  );
}
