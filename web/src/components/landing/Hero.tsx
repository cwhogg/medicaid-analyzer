import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QueryCounter } from "./QueryCounter";

export function Hero() {

  return (
    <section className="text-center py-12 sm:py-16">
      <div className="max-w-[820px] mx-auto px-4 sm:px-8">
        <h2 className="font-headline text-[2rem] sm:text-[2.5rem] md:text-[2.75rem] font-bold leading-[1.15] text-foreground mb-6 animate-fade-in-up">
          Making Public Health{" "}<br className="hidden sm:inline" />Data Accessible
        </h2>
        <p className="font-subhead italic text-[1.0625rem] leading-[1.7] text-body max-w-[640px] mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          Ask questions in plain English about Medicaid claims, Medicare physician spending,
          and population health surveys. AI translates your words into SQL and returns real
          answers from federal datasets.
        </p>

        <div className="flex flex-col items-center gap-6 mb-10 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <Link href="/datasets" className="btn-primary inline-flex items-center justify-center gap-2 w-full sm:w-auto">
            Ask Your First Question
            <ArrowRight className="w-4 h-4" />
          </Link>
          <QueryCounter />
        </div>
      </div>

      {/* Stats row */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <div className="grid grid-cols-2 sm:grid-cols-5 border-t-2 border-foreground border-b border-rule">
          <div className="stat-cell">
            <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight">227M</div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1">Spending Records</div>
            <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide">Medicaid 2018&ndash;2024</div>
          </div>
          <div className="stat-cell">
            <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight">107M</div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1">Physician Records</div>
            <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide">Medicare 2013&ndash;2023</div>
          </div>
          <div className="stat-cell">
            <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight">72M</div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1">Hospital Discharges</div>
            <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide">Medicare Inpatient 2013&ndash;2023</div>
          </div>
          <div className="stat-cell">
            <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight">4.0M</div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1">Survey Respondents</div>
            <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide">BRFSS 2014&ndash;2024</div>
          </div>
          <div className="stat-cell border-r-0">
            <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight">12K</div>
            <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1">Clinical Exams</div>
            <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide">NHANES 2021&ndash;2023</div>
          </div>
        </div>
      </div>
    </section>
  );
}
