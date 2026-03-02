import { registerDataset } from "@/lib/datasets";
import { generateMedicareSchemaPrompt } from "@/lib/medicareSchemas";
import { medicareVariableGroups } from "@/lib/variableMeta";

registerDataset({
  key: "medicare",
  label: "Medicare",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateMedicareSchemaPrompt,
  systemPromptPreamble:
    "You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicare physician/provider spending dataset (Part B fee-for-service, 2023).",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from the available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements. Use DuckDB SQL syntax.
- To calculate total spending: SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs). All Avg_* columns are per-service averages.
- To calculate total charges: SUM(Avg_Sbmtd_Chrg * Tot_Srvcs).
- Round dollar amounts with ROUND(..., 0) — no cents.
- Provider info is inline: use Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name, Rndrng_Prvdr_Type directly. No JOINs needed.
- HCPCS descriptions are inline: use HCPCS_Desc directly. No JOINs needed.
- Use Rndrng_Prvdr_State_Abrvtn for state analysis.
- Use Rndrng_Prvdr_Type for specialty analysis.
- CRITICAL: Tot_Benes CANNOT be summed across HCPCS codes or providers because beneficiaries overlap. Only report beneficiary counts per individual code or per individual provider.
- Providers with <11 beneficiaries per HCPCS code are excluded from the data (privacy suppression).
- When the user asks about "top providers" or individual providers, show Rndrng_Prvdr_Last_Org_Name + Rndrng_Prvdr_First_Name + Rndrng_Prvdr_Crdntls + state for readability.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- Total spending = SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs).
- Provider info and HCPCS descriptions are inline — no JOINs needed.`,

  pageTitle: "Analyze Medicare Spending",
  pageSubtitle:
    "Ask questions about Medicare physician spending (2023) in natural language",
  inputHeading: "Ask a question about Medicare spending",
  inputPlaceholder: "What are the top 10 specialties by total Medicare spending?",

  yearFilter: null,
  deepAnalysisSupported: true,

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      {
        patterns: ["medicaid"],
        reason:
          "This is the Medicare dataset, not Medicaid. Try the Medicaid dataset for Medicaid spending questions.",
      },
      {
        patterns: ["inpatient drg", "hospital drg", "drg payment"],
        reason:
          "This dataset covers Medicare Part B physician/professional services only, not inpatient DRG hospital payments.",
      },
      {
        patterns: ["part d", "drug plan", "prescription drug plan"],
        reason:
          "This dataset covers Part B physician services. Part D prescription drug plan data is not included.",
      },
      {
        patterns: ["advantage", "part c", "managed care"],
        reason:
          "This dataset covers fee-for-service Medicare Part B only, not Medicare Advantage (Part C).",
      },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  resultCaveat: {
    title: "Medicare Part B physician data (2023)",
    text: "Fee-for-service Medicare Part B claims. Providers with fewer than 11 beneficiaries per service are excluded for privacy.",
    borderColor: "border-emerald-500/30",
    titleColor: "text-emerald-300",
  },

  exampleQueries: [
    {
      label: "Top specialties",
      question: "What are the top 10 specialties by total Medicare spending?",
    },
    {
      label: "State comparison",
      question:
        "Which states have the highest total Medicare physician spending?",
    },
    {
      label: "Highest-paid providers",
      question: "Who are the top 20 highest-paid individual providers?",
    },
    {
      label: "Drug vs non-drug",
      question:
        "What percentage of total spending is on drugs vs non-drug services?",
    },
    {
      label: "Charge vs payment",
      question:
        "Which HCPCS codes have the biggest gap between submitted charges and Medicare payments?",
    },
  ],

  variableGroups: medicareVariableGroups,

  domainKnowledge: `## Medicare Part B Domain Knowledge
- This dataset covers Medicare Part B (physician/professional services) fee-for-service claims for calendar year 2023
- Does NOT include: Part A (hospital inpatient DRG), Part C (Medicare Advantage), Part D (prescription drugs)
- ~9.7M rows, ~1.2M unique providers, ~6,500 unique HCPCS codes
- Data is annual — one row per provider + HCPCS + place of service
- Payment amounts are AVERAGES per service — multiply by Tot_Srvcs to get totals
- Avg_Mdcr_Stdzd_Amt removes geographic wage index adjustments for fair comparison across regions
- Rndrng_Prvdr_Type contains ~100 specialty categories (e.g., Internal Medicine, Family Practice, Cardiology)
- Place_Of_Srvc: F=Facility (hospital outpatient), O=Office — same service often has different payment rates
- HCPCS_Drug_Ind=Y flags Part B drug codes (mostly J-codes for physician-administered drugs like chemotherapy, biologics)
- Privacy suppression: providers with <11 beneficiaries for a given HCPCS code are completely excluded
- Top specialties by volume: Internal Medicine, Family Practice, Nurse Practitioner, Cardiology, Orthopedic Surgery
- E/M office visit codes (99211-99215) dominate by volume; J-codes and surgical codes dominate by spending
- The "charge-to-payment ratio" (submitted charges vs actual payment) reveals provider billing patterns — typical ratio is 3-5x
- CRITICAL: Tot_Benes CANNOT be summed across HCPCS codes or providers because beneficiaries overlap between codes/providers. Only report beneficiary counts per individual code or per individual provider.`,
});
