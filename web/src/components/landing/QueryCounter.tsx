"use client";

import { useEffect, useState, useRef } from "react";

function useCountUp(target: number, duration = 1800): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (target <= 0) return;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return value;
}

export function QueryCounter() {
  const [count, setCount] = useState<number | null>(null);
  const displayCount = useCountUp(count ?? 0);

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
    <div className="flex flex-col items-center gap-0.5">
      <div className="font-headline text-[1.75rem] sm:text-[2rem] font-bold text-foreground leading-[1.1] tracking-tight tabular-nums">
        {displayCount.toLocaleString()}
      </div>
      <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body">
        Questions Answered
      </div>
    </div>
  );
}
