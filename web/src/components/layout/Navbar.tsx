"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, MessageSquare, Loader2, Check } from "lucide-react";
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

  const navLinks = [
    { href: "/", label: "Home", active: pathname === "/" },
    ...DATASET_METAS.map((m) => ({
      href: m.href,
      label: m.key === "brfss" || m.key === "nhanes" ? m.key.toUpperCase() : m.title.split(" ")[0],
      active: pathname === m.href,
    })),
    { href: "/datasets", label: "Datasets", active: pathname === "/datasets" },
    { href: "/blog", label: "Blog", active: pathname.startsWith("/blog") },
  ];

  return (
    <>
      <header className="bg-surface text-center pt-3">
        <div className="max-w-[1080px] mx-auto px-4 sm:px-8">
          <hr className="rule-thick" />
          <Link href="/" className="block">
            <h1
              className="font-headline text-[1.875rem] font-bold tracking-[0.08em] text-foreground py-4 leading-tight"
              style={{ fontVariant: "small-caps" }}
            >
              Open Health Data Hub
            </h1>
          </Link>
          <hr className="rule" />

          {/* Desktop nav */}
          <nav className="hidden sm:flex justify-center items-center gap-1 py-3 flex-wrap" aria-label="Main navigation">
            {navLinks.map((link, i) => (
              <span key={link.href} className="flex items-center gap-1">
                {i > 0 && <span className="text-rule text-xs select-none">&middot;</span>}
                <Link
                  href={link.href}
                  className={cn(
                    "text-[0.8125rem] font-semibold tracking-[0.06em] uppercase px-2.5 py-1 transition-colors",
                    link.active ? "text-accent" : "text-foreground hover:text-accent"
                  )}
                >
                  {link.label}
                </Link>
              </span>
            ))}
            <span className="text-rule text-xs select-none">&middot;</span>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="text-[0.8125rem] font-semibold tracking-[0.06em] uppercase px-2.5 py-1 transition-colors text-accent hover:text-accent-hover flex items-center gap-1.5"
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
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-2.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-colors",
                    link.active ? "text-accent bg-red-50" : "text-foreground hover:text-accent hover:bg-background"
                  )}
                >
                  {link.label}
                </Link>
              ))}
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
