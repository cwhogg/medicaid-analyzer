"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Users, FileText } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatCurrency, formatCompactNumber } from "@/lib/format";

interface Stats {
  total_rows: number;
  total_spending: number;
  unique_providers: number;
  unique_hcpcs_codes: number;
  total_claims: number;
  earliest_month: string;
  latest_month: string;
}

function AnimatedCounter({ end, prefix = "", suffix = "" }: { end: string; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState("");

  useEffect(() => {
    const duration = 1500;
    const start = Date.now();

    function step() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      if (progress < 1) {
        // Show scrambled version while animating
        const chars = end.split("");
        const revealed = Math.floor(chars.length * eased);
        const display = chars
          .map((c, i) => {
            if (i < revealed) return c;
            if (/\d/.test(c)) return String(Math.floor(Math.random() * 10));
            return c;
          })
          .join("");
        setDisplay(prefix + display + suffix);
        requestAnimationFrame(step);
      } else {
        setDisplay(prefix + end + suffix);
      }
    }

    requestAnimationFrame(step);
  }, [end, prefix, suffix]);

  return <span>{display}</span>;
}

export function Hero() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/data/stats.json")
      .then((r) => r.json())
      .then((data) => setStats(data[0]))
      .catch(console.error);
  }, []);

  const statCards = stats
    ? [
        {
          label: "Total Spending",
          value: formatCurrency(stats.total_spending),
          icon: TrendingUp,
          delay: "0s",
        },
        {
          label: "Claims Processed",
          value: formatCompactNumber(stats.total_claims),
          icon: FileText,
          delay: "0.1s",
        },
        {
          label: "Unique Providers",
          value: formatCompactNumber(stats.unique_providers),
          icon: Users,
          delay: "0.2s",
        },
      ]
    : [];

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-20 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-card text-sm text-muted mb-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            227M+ records analyzed
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
            Explore Medicaid
            <br />
            <span className="text-accent">Spending Data</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Query $1+ trillion in Medicaid provider and procedure spending across 617K+ providers
            and 10K+ HCPCS/CPT codes. Ask questions in plain English — AI generates
            SQL, executes it against 227M rows, and returns results with visualizations.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/analyze" className="btn-primary inline-flex items-center justify-center gap-2 text-base w-full sm:w-auto">
              Start Analyzing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="btn-secondary inline-flex items-center justify-center gap-2 text-base w-full sm:w-auto">
              Learn More
            </a>
          </div>
        </div>

        {/* Animated stat cards */}
        {stats && (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {statCards.map((stat) => (
              <GlassCard
                key={stat.label}
                hover
                className="p-6 text-center animate-fade-in-up"
              >
                <stat.icon className="w-5 h-5 text-accent mx-auto mb-2" />
                <div className="text-2xl font-bold text-white font-mono">
                  <AnimatedCounter end={stat.value} />
                </div>
                <div className="text-sm text-muted mt-1">{stat.label}</div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
