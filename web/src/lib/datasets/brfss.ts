import { registerDataset } from "@/lib/datasets";
import { generateBRFSSSchemaPrompt } from "@/lib/brfssSchemas";

registerDataset({
  key: "brfss",
  label: "BRFSS (beta)",
  beta: true,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt: generateBRFSSSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL for BRFSS survey data.",
  systemPromptRules: `Rules:
- Return ONLY SQL query text. No markdown, no explanation.
- EXCEPTION: If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: followed by a brief reason.
- Always include LIMIT (max 10000) unless a single-row aggregate answer is required.
- Only use SELECT statements.
- Use DuckDB SQL syntax.
- Prefer weighted estimates using _LLCPWT when producing prevalence/means.`,
  retrySystemPromptRules: `Rules:
- Return ONLY SQL query text. No markdown, no explanation.
- Always include LIMIT (max 10000).
- Only use SELECT statements.
- Use DuckDB SQL syntax.`,

  pageTitle: "Analyze Population Health",
  pageSubtitle: "Ask questions about BRFSS survey data in natural language (beta)",
  inputHeading: "Ask a question about BRFSS population health",
  inputPlaceholder: "What is the weighted prevalence of diabetes by age group?",

  yearFilter: null,
  deepAnalysisSupported: false,
  deepAnalysisDisabledReason: "Deep analysis path coming in BRFSS phase 2",

  resultCaveat: {
    title: "BRFSS beta caveats",
    text: "Self-reported cross-sectional survey data. Use results for directional insight, not causal claims. Weighted estimates are preferred where possible.",
    borderColor: "border-amber-500/30",
    titleColor: "text-amber-300",
  },
});
