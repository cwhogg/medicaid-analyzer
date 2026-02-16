import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

const included = [
  "Physician & professional fees (office visits, surgery, hospital rounds)",
  "Personal care & home health services (T-codes)",
  "Drugs & biologicals administered by providers (J-codes)",
  "Durable medical equipment & supplies (A/E/L-codes)",
  "Behavioral health & rehab services (H-codes)",
  "Emergency department visits (99281–99285)",
  "Dental services (D-codes)",
  "Inpatient physician services (admission, daily care, discharge)",
  "State population & Medicaid enrollment for per-capita analysis",
];

const notIncluded = [
  "Hospital facility costs (room & board, OR fees, overhead) — no DRGs",
  "Diagnosis codes (ICD-10) or clinical outcomes",
  "Patient demographics (age, race, gender)",
  "Drug names (only J-codes for provider-administered drugs, not pharmacy fills)",
  "Facility type or place of service",
  "Payer mix or dual-eligible status",
];

const canAsk = [
  "Which providers receive the most Medicaid spending?",
  "What are the top procedures by total claims or dollars?",
  "How has spending on remote patient monitoring grown since 2020?",
  "Which states have the highest Medicaid spending per enrollee?",
  "What does a specific provider (by NPI) bill for?",
  "How do personal care service costs compare across states?",
];

const cannotAsk = [
  "What is the total cost of a knee replacement including hospital stay?",
  "Which diagnoses drive the most Medicaid spending?",
  "How many 65+ patients receive home health services?",
  "What drugs are prescribed most often under Medicaid?",
  "Which hospitals have the highest inpatient costs?",
  "How do outcomes differ by patient demographics?",
];

export function DataScope() {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            About the Data
          </h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            This tool analyzes the{" "}
            <span className="text-white">CMS Medicaid Provider Utilization and Spending</span>{" "}
            dataset — 227M+ HCPCS/CPT-coded claims from January 2018 through September 2024.
            It covers what providers billed Medicaid, not total program costs.
          </p>
        </div>

        {/* What's included vs not */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <GlassCard className="p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              What&apos;s in the dataset
            </h3>
            <ul className="space-y-2.5">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              What&apos;s NOT in the dataset
            </h3>
            <ul className="space-y-2.5">
              {notIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>

        {/* Example queries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard className="p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-accent" />
              Questions you can ask
            </h3>
            <ul className="space-y-2.5">
              {canAsk.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <span className="text-accent mt-0.5 shrink-0">&ldquo;</span>
                  <span className="text-muted">{item}<span className="text-accent">&rdquo;</span></span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="p-5 sm:p-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-muted-dark" />
              Questions that won&apos;t work
            </h3>
            <ul className="space-y-2.5">
              {cannotAsk.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <span className="text-muted-dark mt-0.5 shrink-0">&ldquo;</span>
                  <span className="text-muted-dark">{item}<span className="text-muted-dark">&rdquo;</span></span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
