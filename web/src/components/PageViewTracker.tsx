"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const utm_source = searchParams.get("utm_source") || undefined;
    const utm_medium = searchParams.get("utm_medium") || undefined;
    const utm_campaign = searchParams.get("utm_campaign") || undefined;

    const body = {
      path: pathname,
      referrer: document.referrer || undefined,
      utm_source,
      utm_medium,
      utm_campaign,
    };

    // Fire-and-forget beacon
    fetch("/api/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // Silently ignore — never block page rendering
    });
  }, [pathname, searchParams]);

  return null;
}
