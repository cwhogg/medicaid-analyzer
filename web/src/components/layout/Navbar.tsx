"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Loader2, Check, ChevronDown } from "lucide-react";
import { DATASET_METAS } from "@/lib/datasetMeta";
import { cn } from "@/lib/utils";

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setTimeout(onClose, 1500);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface border border-rule rounded-sm w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-headline font-bold text-foreground">Give Feedback</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-sm text-green-700">Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind? Bug reports, feature requests, or general thoughts..."
              className="w-full h-32 bg-background border border-rule rounded-sm p-3 text-sm text-foreground placeholder:text-muted resize-none focus:outline-none focus:border-accent transition-colors font-subhead italic"
              maxLength={2000}
              autoFocus
              disabled={status === "sending"}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted">{message.length}/2000</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === "sending"}
                  className="btn-primary flex items-center gap-2"
                >
                  {status === "sending" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </div>
            {status === "error" && (
              <p className="text-xs text-red-600 mt-2">Failed to send. Please try again.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const [datasetsOpen, setDatasetsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDatasetPage = DATASET_METAS.some((m) => pathname === m.href);

  const topLinks = [
    { href: "/", label: "Home", active: pathname === "/" },
    { href: "/analyze", label: "Analyze", active: pathname === "/analyze" },
  ];
  const bottomLinks = [
    { href: "/blog", label: "Blog", active: pathname.startsWith("/blog") },
    { href: "/validation", label: "Validation", active: pathname === "/validation" },
  ];

  const datasetLinks = DATASET_METAS.map((m) => ({
    href: m.href,
    label: m.key === "brfss" || m.key === "nhanes" ? m.key.toUpperCase() : m.title,
    active: pathname === m.href,
    subtitle: m.subtitle,
  }));

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setDatasetsOpen(true);
  };
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setDatasetsOpen(false), 200);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDatasetsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const linkClass = "text-[0.8125rem] font-semibold tracking-[0.06em] uppercase px-2.5 py-1 transition-colors";

  return (
    <>
      <header className="bg-surface text-center pt-3">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-8">
          <hr className="rule-thick" />
          <Link href="/" className="block">
            <h1
              className="font-headline text-[1.375rem] sm:text-[1.875rem] font-bold tracking-[0.04em] sm:tracking-[0.08em] text-foreground py-3 sm:py-4 leading-tight"
              style={{ fontVariant: "small-caps" }}
            >
              Open Health Data Hub
            </h1>
          </Link>
          <hr className="rule" />

          {/* Desktop nav */}
          <nav className="hidden sm:flex justify-center items-center gap-1 py-3 flex-wrap" aria-label="Main navigation">
            {topLinks.map((link, i) => (
              <span key={link.href} className="flex items-center gap-1">
                {i > 0 && <span className="text-rule text-xs select-none">&middot;</span>}
                <Link
                  href={link.href}
                  className={cn(linkClass, link.active ? "text-accent" : "text-foreground hover:text-accent")}
                >
                  {link.label}
                </Link>
              </span>
            ))}

            <span className="text-rule text-xs select-none">&middot;</span>

            {/* Datasets dropdown */}
            <div
              ref={dropdownRef}
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => setDatasetsOpen(!datasetsOpen)}
                className={cn(
                  linkClass,
                  "flex items-center gap-1",
                  isDatasetPage || pathname === "/datasets" ? "text-accent" : "text-foreground hover:text-accent"
                )}
              >
                Datasets
                <ChevronDown className={cn("w-3 h-3 transition-transform", datasetsOpen && "rotate-180")} />
              </button>

              {datasetsOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                  <div className="bg-surface border border-rule rounded-sm shadow-lg min-w-[220px] py-1.5">
                    {datasetLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setDatasetsOpen(false)}
                        className={cn(
                          "block px-4 py-2 text-left transition-colors",
                          link.active
                            ? "text-accent bg-red-50/60"
                            : "text-foreground hover:text-accent hover:bg-background"
                        )}
                      >
                        <span className="block text-[0.8125rem] font-semibold tracking-wide">{link.label}</span>
                        <span className="block text-[0.6875rem] text-muted leading-tight mt-0.5">{link.subtitle}</span>
                      </Link>
                    ))}
                    <hr className="rule my-1.5" />
                    <Link
                      href="/datasets"
                      onClick={() => setDatasetsOpen(false)}
                      className={cn(
                        "block px-4 py-2 text-left transition-colors",
                        pathname === "/datasets"
                          ? "text-accent bg-red-50/60"
                          : "text-foreground hover:text-accent hover:bg-background"
                      )}
                    >
                      <span className="block text-[0.8125rem] font-semibold tracking-wide">All Datasets</span>
                      <span className="block text-[0.6875rem] text-muted leading-tight mt-0.5">Overview &amp; documentation</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {bottomLinks.map((link) => (
              <span key={link.href} className="flex items-center gap-1">
                <span className="text-rule text-xs select-none">&middot;</span>
                <Link
                  href={link.href}
                  className={cn(linkClass, link.active ? "text-accent" : "text-foreground hover:text-accent")}
                >
                  {link.label}
                </Link>
              </span>
            ))}

            <span className="text-rule text-xs select-none">&middot;</span>
            <button
              onClick={() => setFeedbackOpen(true)}
              className={cn(linkClass, "text-accent hover:text-accent-hover flex items-center gap-1.5")}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Feedback
            </button>
          </nav>

          {/* Mobile hamburger */}
          <div className="sm:hidden flex justify-end py-2">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 text-muted hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <hr className="rule" />
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden bg-surface border-b border-rule">
            <div className="px-4 py-3 space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname === "/" ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                )}
              >
                Home
              </Link>

              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname === "/analyze" ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                )}
              >
                Analyze
              </Link>

              {/* Mobile datasets section */}
              <div>
                <button
                  onClick={() => setDatasetsOpen(!datasetsOpen)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                    isDatasetPage || pathname === "/datasets"
                      ? "text-accent bg-red-50"
                      : "text-foreground hover:text-accent hover:bg-background"
                  )}
                >
                  Datasets
                  <ChevronDown className={cn("w-4 h-4 transition-transform", datasetsOpen && "rotate-180")} />
                </button>
                {datasetsOpen && (
                  <div className="ml-3 border-l-2 border-rule pl-3 mt-1 space-y-0.5">
                    {datasetLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "block px-3 py-2 rounded-sm text-sm font-semibold tracking-wider transition-colors",
                          link.active ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      href="/datasets"
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block px-3 py-2 rounded-sm text-sm tracking-wider transition-colors text-muted hover:text-accent hover:bg-background"
                      )}
                    >
                      All Datasets
                    </Link>
                  </div>
                )}
              </div>

              <Link
                href="/blog"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname.startsWith("/blog") ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                )}
              >
                Blog
              </Link>

              <Link
                href="/validation"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                  pathname === "/validation" ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                )}
              >
                Validation
              </Link>

              <button
                onClick={() => { setMobileOpen(false); setFeedbackOpen(true); }}
                className="w-full text-center btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>
            </div>
          </div>
        )}
      </header>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
