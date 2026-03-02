import { registerDataset } from "@/lib/datasets";
import { generateBRFSSSchemaPrompt } from "@/lib/brfssSchemas";

registerDataset({
  key: "brfss",
  label: "BRFSS",
  beta: false,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateBRFSSSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL for BRFSS (Behavioral Risk Factor Surveillance System) 2023 survey data.",
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
- Include sample_n (unweighted count of valid respondents) alongside weighted estimates for context.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements.
- Use DuckDB SQL syntax.
- Use _LLCPWT for weighted estimates.
- Add readable labels via CASE WHEN for coded values.`,

  pageTitle: "Analyze Population Health",
  pageSubtitle: "Ask questions about BRFSS population health survey data in natural language",
  inputHeading: "Ask a question about population health",
  inputPlaceholder: "What is the weighted prevalence of diabetes by age group?",

  yearFilter: null,
  deepAnalysisSupported: true,

  exampleQueries: [
    { label: "Diabetes by age", question: "What is the weighted prevalence of diabetes by age group?" },
    { label: "Exercise by state", question: "Which states have the highest rates of no exercise in the past 30 days?" },
    { label: "Mental health by income", question: "What is the average number of poor mental health days by income level?" },
    { label: "Smoking by education", question: "How does current smoking prevalence vary by education level?" },
  ],

  resultCaveat: {
    title: "BRFSS survey data",
    text: "Self-reported cross-sectional survey data weighted for population representativeness. Use for directional insight, not causal claims.",
    borderColor: "border-sky-500/30",
    titleColor: "text-sky-300",
  },

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      { patterns: ["medicaid", "medicare", "claims", "billing", "reimbursement", "provider spending", "hcpcs", "npi"], reason: "BRFSS is a population health survey, not a claims/billing dataset. Try the Medicaid dataset for spending and provider questions." },
      { patterns: ["individual patient", "patient record", "specific person"], reason: "BRFSS is anonymized survey data — individual respondents cannot be identified." },
      { patterns: ["longitudinal", "over time", "trend", "year over year", "change since"], reason: "This BRFSS dataset is 2023 only (cross-sectional). Trends over time require multi-year data." },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  domainKnowledge: `## BRFSS Domain Knowledge
- BRFSS is the world's largest continuously conducted telephone health survey (CDC, annual since 1984)
- 2023 dataset: 433K respondents, all 50 states + DC + territories
- Cross-sectional: one point in time, no longitudinal tracking of individuals
- Self-reported data: may underestimate stigmatized behaviors (smoking, drinking) and overestimate healthy behaviors (exercise)
- Phone-based sample: may underrepresent populations without phone access
- Survey weights (_LLCPWT) adjust for probability of selection and non-response — ALWAYS use for population estimates
- Calculated variables (prefixed with _) are pre-cleaned by CDC and preferred over raw variables
- Key health disparities: chronic conditions cluster by income, education, race; rural/urban gaps are significant
- Mental health: MENTHLTH captures "frequent mental distress" (14+ days) as a key population health indicator
- Obesity prevalence varies dramatically by state (20-40%) and is strongly associated with income and education
- BRFSS underestimates some conditions compared to clinical data (e.g., diabetes prevalence is ~12% in BRFSS vs ~14% clinically)
- Optional modules (ACEs, firearms, sexual orientation) have limited state coverage — note this in results`,
});
