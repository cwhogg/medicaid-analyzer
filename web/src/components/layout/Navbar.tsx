"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-nav">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <Database className="w-6 h-6 text-accent group-hover:scale-110 transition-transform" />
            <span className="font-semibold text-lg text-white">
              Medicaid Claims Analyzer
            </span>
          </Link>

          <div className="flex items-center gap-6">
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
        </div>
      </div>
    </nav>
  );
}
