import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

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
    <section className="py-16">
      <div className="max-w-[1080px] mx-auto px-4 sm:px-8">
        <div className="text-center mb-12">
          <h2 className="font-headline text-[1.875rem] sm:text-[2.25rem] font-bold text-foreground">
            About the Data
          </h2>
          <p className="mt-4 font-serif text-body max-w-2xl mx-auto leading-relaxed">
            This tool analyzes the{" "}
            <span className="text-foreground font-semibold">CMS Medicaid Provider Utilization and Spending</span>{" "}
            dataset — 227M+ HCPCS/CPT-coded claims from January 2018 through September 2024.
            It covers what providers billed Medicaid, not total program costs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card p-5 sm:p-8">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              What&apos;s in the dataset
            </h3>
            <ul className="space-y-2.5">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-body leading-relaxed font-serif">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600/60 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 sm:p-8">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-accent" />
              What&apos;s NOT in the dataset
            </h3>
            <ul className="space-y-2.5">
              {notIncluded.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-body leading-relaxed font-serif">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent/60 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-5 sm:p-8">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-teal" />
              Questions you can ask
            </h3>
            <ul className="space-y-2.5">
              {canAsk.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed font-serif">
                  <span className="text-teal mt-0.5 shrink-0">&ldquo;</span>
                  <span className="text-body">{item}<span className="text-teal">&rdquo;</span></span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-5 sm:p-8">
            <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-muted" />
              Questions that won&apos;t work
            </h3>
            <ul className="space-y-2.5">
              {cannotAsk.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed font-serif">
                  <span className="text-muted mt-0.5 shrink-0">&ldquo;</span>
                  <span className="text-muted">{item}<span className="text-muted">&rdquo;</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
