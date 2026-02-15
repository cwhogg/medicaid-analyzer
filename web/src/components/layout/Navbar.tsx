"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
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
              href="/analyze"
              className="btn-primary text-sm"
            >
              Start Analyzing
            </Link>
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
              href="/analyze"
              onClick={() => setMobileOpen(false)}
              className="block text-center btn-primary text-sm mt-2"
            >
              Start Analyzing
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
