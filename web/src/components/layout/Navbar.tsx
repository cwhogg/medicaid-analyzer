"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Menu, X, MessageSquare, Loader2, Check } from "lucide-react";
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#141414] border border-white/[0.08] rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Give Feedback</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm text-green-400">Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind? Bug reports, feature requests, or general thoughts..."
              className="w-full h-32 bg-white/[0.03] border border-white/[0.08] rounded-lg p-3 text-sm text-white placeholder:text-muted-dark resize-none focus:outline-none focus:border-accent/50 transition-colors"
              maxLength={2000}
              autoFocus
              disabled={status === "sending"}
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-dark">{message.length}/2000</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || status === "sending"}
                  className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              <p className="text-xs text-red-400 mt-2">Failed to send. Please try again.</p>
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

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 group">
              <Database className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-base sm:text-lg text-white">
                Medicaid Claims Analyzer
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden sm:flex items-center gap-6">
              <Link
                href="/"
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === "/"
                    ? "text-accent"
                    : "text-muted hover:text-white"
                )}
              >
                Home
              </Link>
              <Link
                href="/analyze"
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname === "/analyze"
                    ? "text-accent"
                    : "text-muted hover:text-white"
                )}
              >
                Analyze
              </Link>
              <Link
                href="/blog"
                className={cn(
                  "text-sm font-medium transition-colors",
                  pathname.startsWith("/blog")
                    ? "text-accent"
                    : "text-muted hover:text-white"
                )}
              >
                Blog
              </Link>
              <button
                onClick={() => setFeedbackOpen(true)}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Give Feedback
              </button>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden p-2 -mr-2 text-muted hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t border-white/[0.08] bg-[rgba(10,10,10,0.95)] backdrop-blur-lg">
            <div className="px-4 py-3 space-y-1">
              <Link
                href="/"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === "/"
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-white hover:bg-white/[0.05]"
                )}
              >
                Home
              </Link>
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === "/analyze"
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-white hover:bg-white/[0.05]"
                )}
              >
                Analyze
              </Link>
              <Link
                href="/blog"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith("/blog")
                    ? "text-accent bg-accent/10"
                    : "text-muted hover:text-white hover:bg-white/[0.05]"
                )}
              >
                Blog
              </Link>
              <button
                onClick={() => { setMobileOpen(false); setFeedbackOpen(true); }}
                className="w-full text-center btn-primary text-sm mt-2 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Give Feedback
              </button>
            </div>
          </div>
        )}
      </nav>

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  );
}
