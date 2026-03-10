import { registerDataset } from "@/lib/datasets";
import { generateMedicareInpatientSchemaPrompt } from "@/lib/medicareInpatientSchemas";
import { medicareInpatientVariableGroups } from "@/lib/variableMeta";

const MEDICARE_INPATIENT_YEARS = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013];

function buildYearConstraint(years: number[]): string {
  if (years.length === 1) {
    return `\n\nIMPORTANT: The user has selected year ${years[0]} as a filter. You MUST add WHERE data_year = ${years[0]} to all queries.`;
  }
  return `\n\nIMPORTANT: The user has selected years ${years.join(", ")} as a filter. You MUST add WHERE data_year IN (${years.join(", ")}) to all queries.`;
}

registerDataset({
  key: "medicare-inpatient",
  label: "Medicare Inpatient",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateMedicareInpatientSchemaPrompt,
  systemPromptPreamble:
    "You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicare inpatient hospital spending dataset (Part A IPPS hospitals, 2013-2023).",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from the available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements. Use DuckDB SQL syntax.
- To calculate total spending: SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs). All Avg_* columns are per-discharge averages.
- To calculate total charges: SUM(Avg_Submtd_Cvrd_Chrg * Tot_Dschrgs).
- Round dollar amounts with ROUND(..., 0) — no cents.
- Hospital info is inline: use Rndrng_Prvdr_Org_Name, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_City directly. No JOINs needed.
- DRG descriptions are inline: use DRG_Desc directly. No JOINs needed.
- Use Rndrng_Prvdr_State_Abrvtn for state analysis.
- Use Rndrng_Prvdr_CCN as the unique hospital identifier. CCN is a 6-digit code, not an NPI.
- Use data_year to filter by year or analyze trends over time (2013-2023).
- When the user asks about "top hospitals" or individual hospitals, show Rndrng_Prvdr_Org_Name + Rndrng_Prvdr_City + Rndrng_Prvdr_State_Abrvtn for readability.
- DRG = Diagnosis Related Group. MS-DRG = Medicare Severity DRG. Many DRGs come in severity tiers: "w MCC", "w CC", "w/o CC/MCC".
- Avg_Tot_Pymt_Amt includes Medicare payment + beneficiary cost-sharing. Avg_Mdcr_Pymt_Amt is Medicare-only.
- The difference (Avg_Tot_Pymt_Amt - Avg_Mdcr_Pymt_Amt) approximates beneficiary out-of-pocket cost per discharge.
- Hospitals with fewer than 11 discharges per DRG are excluded (privacy suppression).`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- Total spending = SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs).
- Hospital info and DRG descriptions are inline — no JOINs needed.
- Use data_year to filter by year (2013-2023).`,

  pageTitle: "Analyze Medicare Inpatient Spending",
  pageSubtitle:
    "Ask questions about Medicare inpatient hospital spending by DRG (2013-2023) in natural language",
  inputHeading: "Ask a question about Medicare inpatient hospital spending",
  inputPlaceholder: "Which hospitals have the highest total Medicare inpatient spending?",

  yearFilter: { years: MEDICARE_INPATIENT_YEARS, dateColumn: "data_year" },
  buildYearConstraint,
  deepAnalysisSupported: true,

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      {
        patterns: ["medicaid"],
        reason:
          "This is the Medicare Inpatient dataset, not Medicaid. Try the Medicaid dataset for Medicaid spending questions.",
      },
      {
        patterns: ["physician", "part b", "office visit", "hcpcs", "cpt code", "outpatient physician"],
        reason:
          "This dataset covers Medicare Part A inpatient hospital stays (DRGs), not Part B physician services (HCPCS/CPT). Try the Medicare Physician dataset for those questions.",
      },
      {
        patterns: ["part d", "drug plan", "prescription drug plan"],
        reason:
          "This dataset covers Part A inpatient hospital stays. Part D prescription drug plan data is not included.",
      },
      {
        patterns: ["advantage", "part c", "managed care"],
        reason:
          "This dataset covers fee-for-service Medicare Part A only, not Medicare Advantage (Part C).",
      },
      {
        patterns: ["npi", "individual provider", "doctor name"],
        reason:
          "This dataset identifies hospitals by CCN (CMS Certification Number), not individual physicians by NPI. For individual provider data, try the Medicare Physician dataset.",
      },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  resultCaveat: {
    title: "Medicare Part A inpatient hospital data (2013-2023)",
    text: "IPPS hospital discharges for Original Medicare. Hospitals with fewer than 11 discharges per DRG are excluded for privacy. Payment amounts are averages per discharge.",
    borderColor: "border-teal-500/30",
    titleColor: "text-teal-300",
  },

  exampleQueries: [
    {
      label: "Top hospitals by spending",
      question: "Which hospitals have the highest total Medicare inpatient spending?",
    },
    {
      label: "Most expensive DRGs",
      question: "What are the top 10 most expensive DRGs by total Medicare spending?",
    },
    {
      label: "Spending over time",
      question: "What is the total Medicare inpatient spending by year from 2013 to 2023?",
    },
    {
      label: "Joint replacement costs",
      question: "Which hospitals charge the most for major joint replacement (DRG 470)?",
    },
    {
      label: "State comparison",
      question: "Which states have the highest total Medicare inpatient hospital spending?",
    },
  ],

  variableGroups: medicareInpatientVariableGroups,

  domainKnowledge: `## Medicare Inpatient Hospital Domain Knowledge
- This dataset covers Medicare Part A inpatient hospital discharges from IPPS (Inpatient Prospective Payment System) hospitals
- Covers 2013-2023 (11 years), ~3,000+ hospitals per year, ~2M total rows
- Uses DRG (Diagnosis Related Group) codes instead of HCPCS/CPT codes
- MS-DRG = Medicare Severity DRG. Many DRGs have 3 tiers: "w MCC" (major complications), "w CC" (complications), "w/o CC/MCC"
- Does NOT include: Part B physician services, Part C (Medicare Advantage), Part D (prescription drugs), outpatient hospital, Critical Access Hospitals
- Hospitals identified by CCN (CMS Certification Number), not NPI
- Key high-volume DRGs: sepsis (DRG 871/872), heart failure (DRG 291/292/293), pneumonia (DRG 193/194/195), hip/knee replacement (DRG 469/470), COPD (DRG 190/191/192)
- COVID-19 impact visible in 2020-2021: respiratory DRGs surged, elective procedures dropped
- Hospital charges (Avg_Submtd_Cvrd_Chrg) are chargemaster prices — typically 3-5x what Medicare pays
- Avg_Tot_Pymt_Amt includes Medicare + beneficiary deductible + coinsurance + outlier payments
- Avg_Mdcr_Pymt_Amt is just the Medicare portion (excludes beneficiary cost-sharing)
- The gap between total payment and Medicare payment reveals beneficiary out-of-pocket burden
- Geographic variation in hospital pricing is enormous — same DRG can vary 5-10x in submitted charges across hospitals
- Privacy suppression: hospitals with <11 discharges for a DRG are excluded entirely`,
});
