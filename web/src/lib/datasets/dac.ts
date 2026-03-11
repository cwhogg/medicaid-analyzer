import { registerDataset } from "@/lib/datasets";
import { generateDACSchemaPrompt } from "@/lib/dacSchemas";
import { dacVariableGroups } from "@/lib/variableMeta";

registerDataset({
  key: "dac",
  label: "Clinician Directory",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateDACSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL queries for the CMS Doctors and Clinicians (DAC) National Downloadable File — a directory of ~1.5M Medicare-enrolled clinicians with specialties, credentials, locations, and group practice affiliations.",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000) unless the query is a single aggregated row.
- Only use SELECT statements. Use DuckDB SQL syntax.
- ALWAYS use COUNT(DISTINCT npi) to count clinicians — each NPI can appear on multiple rows.
- Specialty values are ALL CAPS strings (e.g., INTERNAL MEDICINE, not Internal Medicine).
- Gender is coded as M/F (not Male/Female).
- Provide readable labels via CASE WHEN for coded values (gndr, ind_assgn, grp_assgn).
- This dataset has NO spending, payment, or claims data — only provider demographics and enrollment info.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- Use COUNT(DISTINCT npi) to count clinicians, not COUNT(*).
- Specialty values are ALL CAPS. Gender is M/F.
- No spending or payment data — provider directory only.`,

  pageTitle: "Explore the Clinician Directory",
  pageSubtitle: "Ask questions about Medicare-enrolled doctors, specialists, and clinicians across the US",
  inputHeading: "Ask a question about clinicians",
  inputPlaceholder: "How many cardiologists are in each state?",

  yearFilter: null,
  deepAnalysisSupported: true,

  exampleQueries: [
    { label: "Specialties by count", question: "What are the top 20 specialties by number of clinicians?" },
    { label: "Cardiologists by state", question: "How many cardiologists are in each state?" },
    { label: "Gender by specialty", question: "What is the gender breakdown for the top 15 specialties?" },
    { label: "Telehealth adoption", question: "Which specialties have the highest telehealth adoption rate?" },
    { label: "Largest practices", question: "What are the 20 largest group practices by number of members?" },
  ],

  resultCaveat: {
    title: "CMS Clinician Directory (2026)",
    text: "Provider directory data from CMS. One NPI may appear on multiple rows due to multiple enrollments or practice locations. Counts use DISTINCT NPI.",
    borderColor: "border-pink-500/30",
    titleColor: "text-pink-300",
  },

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      { patterns: ["spending", "payment", "cost", "billing", "reimburse", "claims", "charges"], reason: "The Clinician Directory has no spending or payment data. Try the Medicare or Medicaid dataset for financial questions." },
      { patterns: ["brfss", "behavioral risk", "health survey", "obesity rate", "diabetes rate"], reason: "This is a provider directory, not a health survey. Try the BRFSS dataset for population health data." },
      { patterns: ["nhanes", "lab result", "blood pressure", "cholesterol", "bmi"], reason: "This is a provider directory, not a clinical survey. Try the NHANES dataset for clinical measurements." },
      { patterns: ["drg", "diagnosis", "inpatient", "discharge", "hospital stay"], reason: "This is a provider directory without clinical data. Try the Medicare Inpatient dataset for hospital discharge data." },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  variableGroups: dacVariableGroups,

  domainKnowledge: `## Clinician Directory Domain Knowledge
- The DAC National Downloadable File is a CMS directory of all clinicians enrolled in Medicare
- Each row = clinician + enrollment record + group practice + address combination
- A single NPI can appear on multiple rows — always use COUNT(DISTINCT npi)
- ~1.5M unique NPIs, ~2.8M total rows
- Includes primary and up to 4 secondary specialties per clinician
- Specialty values are ALL CAPS (e.g., INTERNAL MEDICINE, CARDIOVASCULAR DISEASE (CARDIOLOGY))
- Covers all Medicare-enrolled providers: physicians, NPs, PAs, therapists, social workers, etc.
- No spending, payment, or utilization data — this is a provider directory only
- Telehealth flag (telehlth=Y) indicates clinician offers telehealth services
- Updated by CMS approximately twice per month
- Useful for workforce analysis: specialty distribution, geographic access, gender representation, medical school pipelines`,
});
