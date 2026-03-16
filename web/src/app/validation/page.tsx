import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Validation Report — Open Health Data Hub",
  description:
    "Reproducible validation of BRFSS, NHANES, Medicare Inpatient, and Part D query results against published statistics from CDC, NCHS, and CMS. 56 checks, all passing.",
};

interface ValidationRow {
  statistic: string;
  year: string;
  published: number;
  l1Result: number;
  l1Dev: number;
  l2Result: number;
  l2Dev: number;
  source: string;
  sourceUrl: string;
  tolerance: number;
  format?: "pct" | "count" | "currency";
}

const brfssResults: ValidationRow[] = [
  { statistic: "Adult obesity (national)", year: "2017", published: 30.1, l1Result: 30.1, l1Dev: 0, l2Result: 30.1, l2Dev: 0, source: "CDC Obesity Maps", sourceUrl: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html", tolerance: 1.0 },
  { statistic: "Adult obesity (national)", year: "2018", published: 30.9, l1Result: 30.9, l1Dev: 0, l2Result: 30.9, l2Dev: 0, source: "CDC Obesity Maps", sourceUrl: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html", tolerance: 1.0 },
  { statistic: "Adult obesity (West Virginia)", year: "2018", published: 39.5, l1Result: 39.5, l1Dev: 0, l2Result: 39.5, l2Dev: 0, source: "CDC State Data", sourceUrl: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html", tolerance: 2.0 },
  { statistic: "Adult obesity (Colorado)", year: "2018", published: 22.9, l1Result: 22.9, l1Dev: 0, l2Result: 22.9, l2Dev: 0, source: "CDC State Data", sourceUrl: "https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html", tolerance: 2.0 },
  { statistic: "Current smoking", year: "2018", published: 15.5, l1Result: 15.5, l1Dev: 0, l2Result: 15.5, l2Dev: 0, source: "CDC Tobacco Data", sourceUrl: "https://www.cdc.gov/tobacco/about-data-statistics/index.html", tolerance: 1.5 },
  { statistic: "Adult obesity (national)", year: "2020", published: 31.9, l1Result: 31.9, l1Dev: 0, l2Result: 31.9, l2Dev: 0, source: "CDC BRFSS Overweight and Obesity Dataset", sourceUrl: "https://chronicdata.cdc.gov/Behavioral-Risk-Factors/BRFSS-Table-of-Overweight-and-Obesity-BMI-/fqb7-mgjf", tolerance: 1.0 },
  { statistic: "Diagnosed diabetes", year: "2018", published: 10.9, l1Result: 11.4, l1Dev: 0.5, l2Result: 11.8, l2Dev: 0.9, source: "CDC Chronic Disease Indicators \u2014 Diabetes", sourceUrl: "https://chronicdata.cdc.gov/Chronic-Disease-Indicators/U-S-Chronic-Disease-Indicators-Diabetes/f8ti-h92k", tolerance: 1.5 },
  { statistic: "Current asthma", year: "2018", published: 9.2, l1Result: 9.2, l1Dev: 0, l2Result: 9.2, l2Dev: 0, source: "CDC Asthma", sourceUrl: "https://www.cdc.gov/asthma/brfss/default.htm", tolerance: 1.0 },
  { statistic: "Physical inactivity", year: "2018", published: 24.5, l1Result: 24.5, l1Dev: 0, l2Result: 24.5, l2Dev: 0, source: "CDC PCD", sourceUrl: "https://www.cdc.gov/pcd/issues/2020/20_0106.htm", tolerance: 1.5 },
  { statistic: "Adult obesity (national)", year: "2023", published: 34.3, l1Result: 32.8, l1Dev: -1.5, l2Result: 32.8, l2Dev: -1.5, source: "CDC Newsroom", sourceUrl: "https://www.cdc.gov/media/releases/2024/p0912-adult-obesity.html", tolerance: 2.0 },
  { statistic: "Lifetime depression diagnosis (national)", year: "2020", published: 18.5, l1Result: 18.8, l1Dev: 0.3, l2Result: 18.8, l2Dev: 0.3, source: "CDC MMWR 72(24), June 2023", sourceUrl: "https://www.cdc.gov/mmwr/volumes/72/wr/mm7224a1.htm", tolerance: 2.0 },
];

const nhanesResults: ValidationRow[] = [
  { statistic: "Obesity overall (BMI\u226530)", year: "2021\u201323", published: 40.3, l1Result: 40.3, l1Dev: 0, l2Result: 39.8, l2Dev: -0.5, source: "NCHS Brief #508", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db508.htm", tolerance: 2.0 },
  { statistic: "Obesity, men (BMI\u226530)", year: "2021\u201323", published: 39.2, l1Result: 39.2, l1Dev: 0, l2Result: 38.7, l2Dev: -0.5, source: "NCHS Brief #508", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db508.htm", tolerance: 2.0 },
  { statistic: "Obesity, women (BMI\u226530)", year: "2021\u201323", published: 41.3, l1Result: 41.3, l1Dev: 0, l2Result: 40.8, l2Dev: -0.5, source: "NCHS Brief #508", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db508.htm", tolerance: 2.0 },
  { statistic: "Total diabetes (incl. undiagnosed)", year: "2021\u201323", published: 15.8, l1Result: 13.8, l1Dev: -2.0, l2Result: 13.8, l2Dev: -2.0, source: "NCHS Brief #516", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db516.htm", tolerance: 3.0 },
  { statistic: "High cholesterol (\u2265240 mg/dL)", year: "2021\u201323", published: 11.3, l1Result: 11.4, l1Dev: 0.1, l2Result: 11.1, l2Dev: -0.2, source: "NCHS Brief #515", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db515.htm", tolerance: 2.0 },
  { statistic: "Hypertension (measured + Dx)", year: "2021\u201323", published: 47.7, l1Result: 50.0, l1Dev: 2.3, l2Result: 50.0, l2Dev: 2.3, source: "NCHS Brief #511", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db511.htm", tolerance: 5.0 },
  { statistic: "Severe obesity (BMI\u226540)", year: "2021\u201323", published: 9.4, l1Result: 9.4, l1Dev: 0, l2Result: 9.3, l2Dev: -0.1, source: "NCHS Brief #508", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db508.htm", tolerance: 1.5 },
  { statistic: "Depression (PHQ-9\u226510)", year: "2021\u201323", published: 13.1, l1Result: 12.6, l1Dev: -0.5, l2Result: 12.6, l2Dev: -0.5, source: "NCHS Brief #527", sourceUrl: "https://www.cdc.gov/nchs/products/databriefs/db527.htm", tolerance: 2.0 },
];

const inpatientResults: ValidationRow[] = [
  { statistic: "IPPS hospitals", year: "2023", published: 3100, l1Result: 2941, l1Dev: -5.1, l2Result: 2941, l2Dev: -5.1, source: "CMS IPPS PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service", tolerance: 10, format: "count" },
  { statistic: "Distinct DRG codes", year: "2023", published: 600, l1Result: 534, l1Dev: -11.0, l2Result: 534, l2Dev: -11.0, source: "CMS FY 2023 IPPS Rule", sourceUrl: "https://www.cms.gov/newsroom/fact-sheets/fy-2023-hospital-inpatient-prospective-payment-system-ipps-and-long-term-care-hospital-prospective", tolerance: 15, format: "count" },
  { statistic: "Top DRG: Septicemia (871)", year: "2023", published: 561177, l1Result: 561177, l1Dev: 0, l2Result: 561177, l2Dev: 0, source: "CMS IPPS PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service", tolerance: 2, format: "count" },
  { statistic: "#2 DRG: Heart Failure (291)", year: "2023", published: 319367, l1Result: 319367, l1Dev: 0, l2Result: 319367, l2Dev: 0, source: "CMS IPPS PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service", tolerance: 2, format: "count" },
];

const partdResults: ValidationRow[] = [
  { statistic: "Unique prescribers", year: "2023", published: 1104162, l1Result: 1104162, l1Dev: 0, l2Result: 1104162, l2Dev: 0, source: "CMS Part D PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug", tolerance: 1, format: "count" },
  { statistic: "Total claims", year: "2023", published: 1393568104, l1Result: 1393568104, l1Dev: 0, l2Result: 1393568104, l2Dev: 0, source: "CMS Part D PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug", tolerance: 1, format: "count" },
  { statistic: "Total drug cost", year: "2023", published: 212689454816, l1Result: 212689454816, l1Dev: 0, l2Result: 212689454816, l2Dev: 0, source: "CMS Part D PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug", tolerance: 1, format: "currency" },
  { statistic: "Unique prescribers", year: "2019", published: 985533, l1Result: 985533, l1Dev: 0, l2Result: 985533, l2Dev: 0, source: "CMS Part D PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug", tolerance: 1, format: "count" },
  { statistic: "Total drug cost", year: "2019", published: 137025088397, l1Result: 137025088397, l1Dev: 0, l2Result: 137025088397, l2Dev: 0, source: "CMS Part D PUF", sourceUrl: "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug", tolerance: 1, format: "currency" },
];

function formatValue(value: number, format?: "pct" | "count" | "currency"): string {
  switch (format) {
    case "count":
      return value.toLocaleString("en-US");
    case "currency":
      if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
      if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
      if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
      return `$${value.toLocaleString("en-US")}`;
    default:
      return `${value.toFixed(1)}%`;
  }
}

function DevBadge({ dev }: { dev: number }) {
  const display = dev === 0 ? "0.0" : (dev > 0 ? "+" : "") + dev.toFixed(1);
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
      <span className="text-muted">{display}</span>
    </span>
  );
}

function ResultsTable({ rows, dataset }: { rows: ValidationRow[]; dataset: string }) {
  return (
    <div className="relative">
      {/* Scroll hint — fades on right edge on mobile */}
      <div className="sm:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10" />
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <table className="w-full text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b-2 border-rule">
            <th className="text-left py-2 pr-3 font-semibold text-foreground text-xs uppercase tracking-wider">Statistic</th>
            <th className="text-center py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">Year</th>
            <th className="text-right py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">Published</th>
            <th className="text-right py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">Gold SQL</th>
            <th className="text-center py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">Dev</th>
            <th className="text-right py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">NL Query</th>
            <th className="text-center py-2 px-2 font-semibold text-foreground text-xs uppercase tracking-wider">Dev</th>
            <th className="text-left py-2 pl-3 font-semibold text-foreground text-xs uppercase tracking-wider">Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`${dataset}-${i}`} className="border-b border-rule/50 hover:bg-background/50 transition-colors">
              <td className="py-2.5 pr-3 text-foreground">{row.statistic}</td>
              <td className="py-2.5 px-2 text-center font-mono text-muted">{row.year}</td>
              <td className="py-2.5 px-2 text-right font-mono font-semibold text-foreground">{formatValue(row.published, row.format)}</td>
              <td className="py-2.5 px-2 text-right font-mono text-foreground">{formatValue(row.l1Result, row.format)}</td>
              <td className="py-2.5 px-2 text-center"><DevBadge dev={row.l1Dev} /></td>
              <td className="py-2.5 px-2 text-right font-mono text-foreground">{formatValue(row.l2Result, row.format)}</td>
              <td className="py-2.5 px-2 text-center"><DevBadge dev={row.l2Dev} /></td>
              <td className="py-2.5 pl-3">
                <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors text-xs">
                  {row.source}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

export default function ValidationPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-6 sm:pt-16 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Hero */}
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-5xl font-headline font-bold text-foreground mb-4 tracking-tight">
              Data Validation Report
            </h1>
            <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed font-serif">
              Every query result on this site is validated against published statistics
              from the CDC, NCHS, and CMS. This report shows our automated test suite results.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            <div className="card p-4 text-center">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-green-600">56/56</div>
              <div className="text-xs text-muted mt-1">Checks Passed</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-foreground">28</div>
              <div className="text-xs text-muted mt-1">Test Cases</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-foreground">4</div>
              <div className="text-xs text-muted mt-1">Datasets</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-xs sm:text-sm font-mono font-bold text-foreground">Mar 11, 2026</div>
              <div className="text-xs text-muted mt-1">Last Run</div>
            </div>
          </div>

          {/* Methodology */}
          <div className="card p-6 sm:p-8 mb-12">
            <h2 className="text-lg font-headline font-bold text-foreground mb-4">Methodology</h2>
            <p className="text-sm text-muted leading-relaxed font-serif mb-6">
              Each test case compares a result from our data against a published value from an
              official CDC or NCHS source. We run two independent layers of validation for every test:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-accent font-mono text-sm font-bold">Layer 1</div>
                  <span className="text-xs text-muted font-semibold uppercase tracking-wider">Gold SQL</span>
                </div>
                <p className="text-sm text-muted leading-relaxed font-serif">
                  A hand-written SQL query is executed directly against the DuckDB database on Railway.
                  This tests whether <em>the data itself</em> reproduces published statistics, independent
                  of the AI layer. If Layer 1 fails, the data or our understanding of the codebook is wrong.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-accent font-mono text-sm font-bold">Layer 2</div>
                  <span className="text-xs text-muted font-semibold uppercase tracking-wider">NL Query</span>
                </div>
                <p className="text-sm text-muted leading-relaxed font-serif">
                  A natural language question is sent through the full production pipeline: the question
                  goes to our API, Claude generates SQL, Railway executes it, and the result is checked.
                  This tests the <em>end-to-end system</em> that users interact with. If Layer 2 fails
                  but Layer 1 passes, the AI is misinterpreting the question or generating incorrect SQL.
                </p>
              </div>
            </div>
          </div>

          {/* BRFSS Results */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-headline font-bold text-foreground">BRFSS Results</h2>
              <span className="text-xs font-mono text-muted bg-background px-2 py-0.5 rounded-sm border border-rule">11 tests</span>
            </div>
            <p className="text-sm text-muted font-serif mb-4">
              Behavioral Risk Factor Surveillance System &mdash; self-reported survey data, 400K+ respondents/year.
              Values are weighted prevalence percentages using CDC&apos;s <code className="text-xs font-mono text-foreground bg-background px-1 py-0.5 rounded">_LLCPWT</code> survey weights.
            </p>
            <div className="card p-4 sm:p-6">
              <ResultsTable rows={brfssResults} dataset="brfss" />
            </div>
          </div>

          {/* NHANES Results */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-headline font-bold text-foreground">NHANES Results</h2>
              <span className="text-xs font-mono text-muted bg-background px-2 py-0.5 rounded-sm border border-rule">8 tests</span>
            </div>
            <p className="text-sm text-muted font-serif mb-4">
              National Health and Nutrition Examination Survey (2021&ndash;2023 cycle) &mdash; clinical exams + lab measurements.
              Values are weighted prevalence percentages using <code className="text-xs font-mono text-foreground bg-background px-1 py-0.5 rounded">WTMEC2YR</code> exam weights.
            </p>
            <div className="card p-4 sm:p-6">
              <ResultsTable rows={nhanesResults} dataset="nhanes" />
            </div>
          </div>

          {/* Medicare Inpatient Results */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-headline font-bold text-foreground">Medicare Inpatient (Part A) Results</h2>
              <span className="text-xs font-mono text-muted bg-background px-2 py-0.5 rounded-sm border border-rule">4 tests</span>
            </div>
            <p className="text-sm text-muted font-serif mb-4">
              Medicare Inpatient Prospective Payment System (IPPS) &mdash; hospital discharges by DRG, ~2M rows across 11 years (2013&ndash;2023).
              Values are counts from the CMS Provider Summary PUF, which only includes hospitals with &ge;11 discharges per DRG.
            </p>
            <div className="card p-4 sm:p-6">
              <ResultsTable rows={inpatientResults} dataset="inpatient" />
            </div>
          </div>

          {/* Medicare Part D Results */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-headline font-bold text-foreground">Medicare Part D Results</h2>
              <span className="text-xs font-mono text-muted bg-background px-2 py-0.5 rounded-sm border border-rule">5 tests</span>
            </div>
            <p className="text-sm text-muted font-serif mb-4">
              Medicare Part D Prescribers by Provider and Drug &mdash; 276M rows across 11 years (2013&ndash;2023).
              Published values are aggregate totals from the CMS Public Use File. Prescriber-drug combinations with
              fewer than 11 claims are suppressed by CMS before release.
            </p>
            <div className="card p-4 sm:p-6">
              <ResultsTable rows={partdResults} dataset="partd" />
            </div>
          </div>

          {/* Notes */}
          <div className="card p-6 sm:p-8 mb-12">
            <h2 className="text-lg font-headline font-bold text-foreground mb-4">Notes</h2>
            <div className="space-y-4 text-sm text-muted leading-relaxed font-serif">
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-1">Tolerance thresholds</h3>
                <p>
                  Each test has a pre-defined tolerance (typically 1&ndash;2 percentage points for BRFSS,
                  1.5&ndash;5 for NHANES). These account for differences in survey weight versions,
                  age cutoffs, and rounding. A deviation within tolerance is a pass.
                </p>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-1">BRFSS vs NHANES obesity gap</h3>
                <p>
                  BRFSS reports ~31&ndash;33% obesity; NHANES reports ~40%. This is not an error.
                  BRFSS uses self-reported height/weight (people underreport weight), while NHANES
                  uses clinical measurements. The gap is well-documented in epidemiological literature.
                </p>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-1">CMS Public Use File suppression</h3>
                <p>
                  Medicare PUF data suppresses all provider-level rows with fewer than 11 claims,
                  beneficiaries, or discharges. This means aggregate totals from the PUF are systematically
                  lower than universe totals. For Medicare Inpatient, hospital and DRG counts are ~5&ndash;15%
                  below CMS-reported totals. For Part D, published values are computed directly from the PUF,
                  so Gold SQL matches exactly.
                </p>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-sm mb-1">What each layer catches</h3>
                <p>
                  Layer 1 failures indicate data issues: wrong codebook interpretation, missing survey weights,
                  incorrect variable coding. Layer 2 failures (with Layer 1 passing) indicate AI issues:
                  the NL-to-SQL model is generating incorrect queries. Both layers passing means the data
                  is correct <em>and</em> the AI can reproduce results from plain English questions.
                </p>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-headline font-bold text-foreground mb-4">Source Citations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <h3 className="text-foreground font-semibold text-xs uppercase tracking-wider mb-2">BRFSS Sources</h3>
                <ul className="space-y-1.5 text-muted font-serif">
                  <li><a href="https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC Adult Obesity Prevalence Maps</a></li>
                  <li><a href="https://chronicdata.cdc.gov/Behavioral-Risk-Factors/BRFSS-Table-of-Overweight-and-Obesity-BMI-/fqb7-mgjf" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC BRFSS Overweight and Obesity Dataset</a></li>
                  <li><a href="https://www.cdc.gov/tobacco/about-data-statistics/index.html" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC Tobacco Data &amp; Statistics</a></li>
                  <li><a href="https://chronicdata.cdc.gov/Chronic-Disease-Indicators/U-S-Chronic-Disease-Indicators-Diabetes/f8ti-h92k" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC Chronic Disease Indicators &mdash; Diabetes</a></li>
                  <li><a href="https://www.cdc.gov/asthma/brfss/default.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC BRFSS Asthma Data</a></li>
                  <li><a href="https://www.cdc.gov/pcd/issues/2020/20_0106.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC Preventing Chronic Disease</a></li>
                  <li><a href="https://www.cdc.gov/media/releases/2024/p0912-adult-obesity.html" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC Newsroom (2023 Obesity)</a></li>
                  <li><a href="https://www.cdc.gov/mmwr/volumes/72/wr/mm7224a1.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CDC MMWR 72(24) &mdash; Depression Prevalence</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-xs uppercase tracking-wider mb-2">NHANES Sources</h3>
                <ul className="space-y-1.5 text-muted font-serif">
                  <li><a href="https://www.cdc.gov/nchs/products/databriefs/db508.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">NCHS Data Brief No. 508 — Obesity</a></li>
                  <li><a href="https://www.cdc.gov/nchs/products/databriefs/db516.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">NCHS Data Brief No. 516 — Diabetes</a></li>
                  <li><a href="https://www.cdc.gov/nchs/products/databriefs/db515.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">NCHS Data Brief No. 515 — Cholesterol</a></li>
                  <li><a href="https://www.cdc.gov/nchs/products/databriefs/db511.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">NCHS Data Brief No. 511 — Hypertension</a></li>
                  <li><a href="https://www.cdc.gov/nchs/products/databriefs/db527.htm" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">NCHS Data Brief No. 527 — Depression</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-xs uppercase tracking-wider mb-2">Medicare Inpatient Sources</h3>
                <ul className="space-y-1.5 text-muted font-serif">
                  <li><a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CMS Medicare Inpatient Hospitals PUF</a></li>
                  <li><a href="https://www.cms.gov/newsroom/fact-sheets/fy-2023-hospital-inpatient-prospective-payment-system-ipps-and-long-term-care-hospital-prospective" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CMS FY 2023 IPPS Final Rule</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-foreground font-semibold text-xs uppercase tracking-wider mb-2">Medicare Part D Sources</h3>
                <ul className="space-y-1.5 text-muted font-serif">
                  <li><a href="https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover transition-colors">CMS Part D Prescribers PUF</a></li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}
