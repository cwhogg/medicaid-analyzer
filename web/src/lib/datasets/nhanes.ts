import { registerDataset } from "@/lib/datasets";
import { generateNHANESSchemaPrompt } from "@/lib/nhanesSchemas";
import { nhanesVariableGroups } from "@/lib/variableMeta";

registerDataset({
  key: "nhanes",
  label: "NHANES",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateNHANESSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL queries for NHANES (National Health and Nutrition Examination Survey) 2021-2023 data — a nationally representative survey with clinical lab results, physical measurements, and questionnaire data for ~12,000 participants.",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000) unless the query is a single aggregated row.
- Only use SELECT statements. Use DuckDB SQL syntax.
- ALWAYS use WTMEC2YR for weighted estimates when any exam or lab data is involved. Use WTINT2YR only for pure demographic/interview-only queries.
- ALWAYS filter out NULLs and refusal codes (7, 9, 77, 99) before calculations.
- ALWAYS provide readable labels via CASE WHEN for coded values — never return raw numeric codes.
- Include sample_n (unweighted count of valid respondents) alongside weighted estimates for context.
- For clinical thresholds: Diabetes = HbA1c >= 6.5%, Hypertension = SBP >= 130 or DBP >= 80, Obesity = BMI >= 30.
- For PHQ-9 depression score: sum DPQ010-DPQ090 (only when all 9 are valid 0-3). Score >= 10 = clinically significant.
- Fasting labs (LBXGLU, LBXTLG, LBDLDL) are available for ~4K participants only. Prefer LBXGH (HbA1c) or LBXSGL (non-fasting glucose) for broader coverage.
- For adults-only analysis, filter RIDAGEYR >= 18 (or >= 20 for education/marital status).
- This is a SINGLE survey cycle (2021-2023). There is NO time trend capability.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- Use WTMEC2YR for weighted estimates.
- Filter NULLs and refusal codes. Add readable labels via CASE WHEN.
- Single cycle (2021-2023), no trends.`,

  pageTitle: "Analyze NHANES Clinical Data",
  pageSubtitle: "Ask questions about NHANES lab results, physical measurements, and health questionnaires (2021-2023)",
  inputHeading: "Ask a question about clinical health data",
  inputPlaceholder: "What is the prevalence of diabetes (HbA1c ≥ 6.5%) by age group?",

  yearFilter: null,
  deepAnalysisSupported: true,

  exampleQueries: [
    { label: "Diabetes by age", question: "What is the prevalence of diabetes (HbA1c >= 6.5%) by age group?" },
    { label: "Obesity by race", question: "What is the average BMI by race/ethnicity for adults?" },
    { label: "Depression prevalence", question: "What percentage of adults have clinically significant depression (PHQ-9 >= 10)?" },
    { label: "Blood pressure", question: "What is the weighted prevalence of hypertension by gender?" },
    { label: "Cholesterol levels", question: "What are the average total cholesterol and HDL levels by age group?" },
  ],

  resultCaveat: {
    title: "NHANES clinical data (2021-2023 cycle)",
    text: "Clinical measurements and lab results from a nationally representative sample of ~12,000 participants. Weighted estimates use WTMEC2YR. Fasting labs available for subsample only.",
    borderColor: "border-violet-500/30",
    titleColor: "text-violet-300",
  },

  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      { patterns: ["medicaid", "medicare", "claims", "billing", "reimbursement", "provider spending", "hcpcs", "npi"], reason: "NHANES is a clinical health survey, not a claims/billing dataset. Try the Medicaid or Medicare dataset for spending questions." },
      { patterns: ["brfss", "behavioral risk factor", "phone survey"], reason: "This is the NHANES dataset with clinical measurements, not BRFSS. Try the BRFSS dataset for phone-survey health data." },
      { patterns: ["trend over time", "over the years", "changed since", "year over year"], reason: "This dataset covers a single survey cycle (2021-2023). For health trends over time, try the BRFSS dataset which spans 2014-2023." },
      { patterns: ["individual patient", "specific person", "patient record"], reason: "NHANES is anonymized survey data — individual participants cannot be identified." },
      { patterns: ["state", "by state", "which state", "county", "zip code", "geographic"], reason: "NHANES does not include geographic identifiers (state, county, ZIP) for privacy. For geographic health data, try the BRFSS dataset." },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  variableGroups: nhanesVariableGroups,

  domainKnowledge: `## NHANES Domain Knowledge
- NHANES is a CDC program that assesses the health/nutrition of adults and children in the US through interviews and physical examinations
- Unlike BRFSS (phone survey, self-reported), NHANES includes actual lab values, measured blood pressure, and physical exams
- The 2021-2023 cycle is the most recent complete cycle (~12K participants, ~8.8K examined)
- Data is cross-sectional (single cycle), NOT longitudinal — cannot track trends
- Survey weights (WTMEC2YR) are essential for nationally representative estimates
- Lab values have varying availability: CBC and biochemistry ~63%, HbA1c ~56%, fasting glucose/lipids ~31%
- Key clinical thresholds: Diabetes (HbA1c >= 6.5%), Prediabetes (5.7-6.4%), Hypertension (SBP >= 130 or DBP >= 80), Obesity (BMI >= 30)
- PHQ-9 depression screening: sum of 9 items each scored 0-3, >= 10 is clinically significant depression
- NHANES oversamples certain groups (elderly, minorities, low income) — weights correct for this
- No geographic identifiers are available (no state, county, or ZIP code) for privacy
- Approximately 35% of participants are children/adolescents — filter by RIDAGEYR >= 18 for adult analyses
- Education (DMDEDUC2) and marital status (DMDMARTZ) are only asked of adults 20+
- Self-reported conditions (DIQ, BPQ, MCQ) can be compared against actual lab values for "undiagnosed" disease analysis`,
});
