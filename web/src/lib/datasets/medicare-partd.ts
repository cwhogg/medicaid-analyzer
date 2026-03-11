import { registerDataset } from "@/lib/datasets";
import { generatePartDSchemaPrompt } from "@/lib/partdSchemas";
import { partdVariableGroups } from "@/lib/variableMeta";

const PARTD_YEARS = [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013];

function buildYearConstraint(years: number[]): string {
  if (years.length === 1) {
    return `\n\nIMPORTANT: The user has selected year ${years[0]} as a filter. You MUST add WHERE data_year = ${years[0]} to all queries.`;
  }
  return `\n\nIMPORTANT: The user has selected years ${years.join(", ")} as a filter. You MUST add WHERE data_year IN (${years.join(", ")}) to all queries.`;
}

registerDataset({
  key: "medicare-partd",
  label: "Medicare Part D",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generatePartDSchemaPrompt,
  systemPromptPreamble:
    "You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicare Part D prescription drug dataset (2013-2023).",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from the available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements. Use DuckDB SQL syntax.
- Tot_Drug_Cst is already a total cost — do NOT multiply by claim count.
- To get cost per claim: ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Clms), 0), 2).
- Round dollar amounts with ROUND(..., 0) for totals, ROUND(..., 2) for per-unit costs.
- Prescriber info is inline: use Prscrbr_Last_Org_Name, Prscrbr_First_Name, Prscrbr_State_Abrvtn directly. No JOINs needed.
- Drug names are inline: use Gnrc_Name (generic) and Brnd_Name (brand). No JOINs needed.
- Use Prscrbr_State_Abrvtn for state analysis.
- Use Prscrbr_NPI as the unique prescriber identifier.
- Use data_year to filter by year or analyze trends over time (2013-2023).
- When the user asks about "top prescribers" or individual prescribers, show Prscrbr_Last_Org_Name + Prscrbr_First_Name + Prscrbr_State_Abrvtn for readability.
- For drug lookups, use LOWER() and LIKE for fuzzy matching on drug names.
- Brand drugs: WHERE Brnd_Name IS NOT NULL. Generic drugs: WHERE Brnd_Name IS NULL.
- GE65 columns are NULL when suppressed (GE65_Sprsn_Flag = '*').
- Prescribers with fewer than 11 claims or beneficiaries per drug are excluded (privacy suppression).`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- Tot_Drug_Cst is already a total — do NOT multiply by claims.
- Prescriber info and drug names are inline — no JOINs needed.
- Use data_year to filter by year (2013-2023).`,

  pageTitle: "Analyze Medicare Part D Prescriptions",
  pageSubtitle:
    "Ask questions about Medicare Part D prescription drug spending (2013-2023) in natural language",
  inputHeading: "Ask a question about Medicare Part D prescriptions",
  inputPlaceholder: "What are the top 10 most prescribed drugs in Medicare?",

  yearFilter: { years: PARTD_YEARS, dateColumn: "data_year" },
  buildYearConstraint,
  deepAnalysisSupported: true,

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      {
        patterns: ["medicaid"],
        reason:
          "This is the Medicare Part D dataset, not Medicaid. Try the Medicaid dataset for Medicaid spending questions.",
      },
      {
        patterns: ["physician", "part b", "office visit", "hcpcs", "cpt code", "outpatient physician"],
        reason:
          "This dataset covers Medicare Part D prescription drugs, not Part B physician services (HCPCS/CPT). Try the Medicare Physician dataset for those questions.",
      },
      {
        patterns: ["inpatient", "part a", "hospital discharge", "drg", "diagnosis related"],
        reason:
          "This dataset covers Part D prescription drugs. For inpatient hospital data (DRGs), try the Medicare Inpatient dataset.",
      },
      {
        patterns: ["advantage", "part c", "managed care"],
        reason:
          "This dataset covers fee-for-service Medicare Part D only, not Medicare Advantage (Part C).",
      },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  resultCaveat: {
    title: "Medicare Part D prescription drug data (2013-2023)",
    text: "Prescriptions prescribed to Original Medicare Part D beneficiaries. Prescribers with fewer than 11 claims or beneficiaries per drug are excluded for privacy. Cost values are totals, not averages.",
    borderColor: "border-teal-500/30",
    titleColor: "text-teal-300",
  },

  exampleQueries: [
    {
      label: "Top prescribed drugs",
      question: "What are the top 10 most prescribed drugs by total claims in 2023?",
    },
    {
      label: "Drug spending over time",
      question: "How has total Medicare Part D drug spending changed from 2013 to 2023?",
    },
    {
      label: "Most expensive drugs",
      question: "Which drugs have the highest cost per claim in 2023?",
    },
    {
      label: "Opioid prescribing trends",
      question: "How has opioid prescribing (hydrocodone, oxycodone) changed over time?",
    },
    {
      label: "Brand vs generic",
      question: "What percentage of Part D spending goes to brand-name vs generic drugs?",
    },
  ],

  variableGroups: partdVariableGroups,

  domainKnowledge: `## Medicare Part D Prescribers Domain Knowledge
- This dataset covers Medicare Part D prescription drugs prescribed by individual providers
- Covers 2013-2023 (11 years), ~25M rows/year, ~276M total rows
- Each row = one prescriber (NPI) + one drug (generic name) for one year
- Does NOT include: Part A (inpatient hospital), Part B (physician services), Part C (Medicare Advantage), Medicaid, commercial insurance
- Drug identification: Gnrc_Name is always populated (generic/chemical name). Brnd_Name is NULL for generic-only drugs.
- Tot_Drug_Cst is already a total cost — NOT an average. Do not multiply by claims.
- Key drug categories: statins (atorvastatin, rosuvastatin), blood pressure (lisinopril, amlodipine), diabetes (metformin, insulin), opioids (hydrocodone, oxycodone), blood thinners (apixaban/Eliquis)
- Opioid prescribing peaked around 2015-2016 and has been declining due to CDC guidelines and enforcement
- Specialty drugs (biologics, oncology) drive a large share of total spending despite low claim counts
- GLP-1 drugs (semaglutide/Ozempic/Wegovy) have seen explosive growth in recent years
- Brand-name drugs typically cost 5-20x more per claim than generics
- Privacy suppression: prescriber+drug combinations with <11 claims or beneficiaries are excluded entirely
- Prscrbr_Type contains specialty text — top specialties include Internal Medicine, Family Practice, Nurse Practitioner
- GE65 columns provide separate metrics for beneficiaries aged 65+ (most Medicare beneficiaries)
- The 30-day fill metric standardizes different supply lengths to a common unit`,
});
