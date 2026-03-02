import { registerDataset } from "@/lib/datasets";
import { generateBRFSSSchemaPrompt } from "@/lib/brfssSchemas";
import { brfssVariableGroups } from "@/lib/variableMeta";

const BRFSS_YEARS = [2023, 2020, 2019, 2018, 2017, 2016, 2015, 2014];

function buildYearConstraint(years: number[]): string {
  if (years.length === 1) {
    const y = years[0];
    return `\n\nIMPORTANT: The user has selected year ${y} as a filter. You MUST add a WHERE clause: WHERE survey_year = ${y}.`;
  }
  return `\n\nIMPORTANT: The user has selected years ${years.join(", ")} as a filter. You MUST add a WHERE clause: WHERE survey_year IN (${years.join(", ")}).`;
}

registerDataset({
  key: "brfss",
  label: "BRFSS",
  beta: false,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateBRFSSSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL for BRFSS (Behavioral Risk Factor Surveillance System) 2014-2023 survey data spanning ~3.5 million respondents across 8 survey years.",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000) unless the query is a single aggregated row.
- Only use SELECT statements.
- Use DuckDB SQL syntax.
- ALWAYS use _LLCPWT survey weight for population estimates and prevalence calculations.
- ALWAYS exclude Don't Know/Refused codes (7, 9, 77, 99 as appropriate) from calculations.
- ALWAYS provide readable labels via CASE WHEN for coded values — never return raw numeric codes without labels.
- Prefer CDC calculated variables (prefixed with _) over raw survey variables when available.
- For days variables (PHYSHLTH, MENTHLTH, POORHLTH), treat 88 as 0 days, exclude 77 and 99.
- Include sample_n (unweighted count of valid respondents) alongside weighted estimates for context.
- For trend queries, GROUP BY survey_year and ORDER BY survey_year. Note: 2021-2022 are not in the data.
- For income analysis: use INCOME2/_INCOMG for 2014-2020, INCOME3/_INCOMG1 for 2023. Do NOT mix across eras.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements.
- Use DuckDB SQL syntax.
- Use _LLCPWT for weighted estimates.
- Add readable labels via CASE WHEN for coded values.
- For trends, GROUP BY survey_year. Note 2021-2022 gap.`,

  pageTitle: "Analyze Population Health",
  pageSubtitle: "Ask questions about BRFSS population health survey data (2014-2023) in natural language",
  inputHeading: "Ask a question about population health",
  inputPlaceholder: "How has obesity prevalence changed from 2014 to 2023?",

  yearFilter: { years: BRFSS_YEARS, dateColumn: "survey_year" },
  buildYearConstraint,
  deepAnalysisSupported: true,

  exampleQueries: [
    { label: "Obesity trend", question: "How has the obesity rate changed from 2014 to 2023?" },
    { label: "Diabetes by age", question: "What is the weighted prevalence of diabetes by age group?" },
    { label: "Smoking trend", question: "How has current smoking prevalence changed over time?" },
    { label: "Mental health by income", question: "What is the average number of poor mental health days by income level?" },
    { label: "Exercise by state", question: "Which states have the highest rates of no exercise in the past 30 days?" },
  ],

  resultCaveat: {
    title: "BRFSS survey data (2014-2020, 2023)",
    text: "Self-reported survey data weighted for population representativeness. 2021-2022 not included. Use for directional insight, not causal claims.",
    borderColor: "border-sky-500/30",
    titleColor: "text-sky-300",
  },

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      { patterns: ["medicaid", "medicare", "claims", "billing", "reimbursement", "provider spending", "hcpcs", "npi"], reason: "BRFSS is a population health survey, not a claims/billing dataset. Try the Medicaid dataset for spending and provider questions." },
      { patterns: ["individual patient", "patient record", "specific person"], reason: "BRFSS is anonymized survey data — individual respondents cannot be identified." },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  variableGroups: brfssVariableGroups,

  domainKnowledge: `## BRFSS Domain Knowledge
- BRFSS is the world's largest continuously conducted telephone health survey (CDC, annual since 1984)
- This dataset spans 8 survey years: 2014-2020 and 2023 (~3.5M total respondents, ~400-490K per year)
- 2021-2022 are excluded due to major variable renames at the 2021 boundary
- All 50 states + DC + territories are represented each year
- Self-reported data: may underestimate stigmatized behaviors (smoking, drinking) and overestimate healthy behaviors (exercise)
- Phone-based sample: may underrepresent populations without phone access
- Survey weights (_LLCPWT) adjust for probability of selection and non-response — ALWAYS use for population estimates
- Calculated variables (prefixed with _) are pre-cleaned by CDC and preferred over raw variables
- Income variable caveat: INCOME2 (8 categories) is used in 2014-2020, INCOME3 (11 categories) is used in 2023 — they are NOT compatible for cross-year comparison without rebinning
- Key health disparities: chronic conditions cluster by income, education, race; rural/urban gaps are significant
- Mental health: MENTHLTH captures "frequent mental distress" (14+ days) as a key population health indicator
- Obesity prevalence varies dramatically by state (20-40%) and has been trending upward over the decade
- Smoking prevalence has been declining steadily over this period
- BRFSS underestimates some conditions compared to clinical data (e.g., diabetes prevalence is ~12% in BRFSS vs ~14% clinically)
- Optional modules (ACEs, firearms, sexual orientation) have limited state coverage — note this in results
- Some columns are only available in certain years (e.g., CHCCOPD3 from 2019+, PRIMINS1 in 2023 only) — see schema for availability notes`,
});
