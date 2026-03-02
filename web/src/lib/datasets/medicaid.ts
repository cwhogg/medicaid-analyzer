import { registerDataset } from "@/lib/datasets";
import { generateSchemaPrompt } from "@/lib/schemas";
import { checkDataScope } from "@/lib/dataScope";

const ALL_YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];

function buildYearConstraint(years: number[]): string {
  if (years.length === 1) {
    const y = years[0];
    return `\n\nIMPORTANT: The user has selected year ${y} as a filter. You MUST add a WHERE clause to filter data to only year ${y}. Use: WHERE claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01'.`;
  }
  const monthConditions = years.map((y) => `(claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01')`).join(" OR ");
  return `\n\nIMPORTANT: The user has selected years ${years.join(", ")} as a filter. You MUST add a WHERE clause to filter data to only these years. Use: WHERE ${monthConditions}.`;
}

registerDataset({
  key: "medicaid",
  label: "Medicaid",
  beta: false,

  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  generateSchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicaid provider spending dataset.",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the available tables cannot answer the user's question, instead of SQL return exactly: CANNOT_ANSWER: followed by a clear explanation of what data is and is not available.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements.
- Use the table names exactly as defined (claims, hcpcs_lookup, npi_lookup).
- Use DuckDB SQL syntax.
- Format dollar amounts with ROUND(..., 0) to whole dollars (no cents).
- When a question is ambiguous, make reasonable assumptions and use the most appropriate approach.
- Use short, distinct table aliases (e.g. c, l, n) and ensure every alias referenced in the query is defined in a FROM or JOIN clause.
- IMPORTANT: Oct-Dec 2024 data is incomplete. For monthly trends or time series queries, add: AND claim_month < '2024-10-01' to exclude incomplete months. For aggregate totals (e.g. "total spending in 2024"), include all available data but note that Oct-Dec figures are partial.
- CRITICAL: Beneficiary counts CANNOT be summed across HCPCS codes or providers because beneficiaries overlap. Only report beneficiary counts per individual code or per individual provider. Never SUM(beneficiaries) across codes or providers.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements.
- Use DuckDB SQL syntax.
- Use short, distinct table aliases.`,

  pageTitle: "Analyze Spending",
  pageSubtitle: "Ask questions about Medicaid provider spending in natural language",
  inputHeading: "Ask a question about Medicaid spending",
  inputPlaceholder: "What are the top 10 services by total spending?",

  yearFilter: { years: ALL_YEARS, dateColumn: "claim_month" },
  buildYearConstraint,
  deepAnalysisSupported: true,
  checkDataScope,

  exampleQueries: [
    { label: "Top services by spending", question: "What are the top 10 services by total spending?" },
    { label: "State spending comparison", question: "Which states have the highest total Medicaid spending?" },
    { label: "Monthly spending trends", question: "What is the monthly spending trend from 2018 to 2024?" },
    { label: "Top providers", question: "Who are the top 10 highest-paid providers?" },
  ],

  domainKnowledge: `## Medicaid Domain Knowledge
- Spending is highly concentrated: a small number of providers and procedures account for the majority of dollars
- J-codes (injections/drugs) dominate high-cost procedures — J0178 (aflibercept), J9312 (rituximab), J1745 (infliximab) are common top spenders
- T-codes (T1019, T1015, T2016) are Medicaid-specific and represent the highest-spending categories overall
- Geographic variation is significant — states like CA, NY, TX, FL have the highest total spending but per-provider averages vary
- Seasonal patterns exist: some procedures spike in Q1 (flu season), behavioral health utilization shows summer dips
- Oct-Dec 2024 data is INCOMPLETE — for time-series or monthly trend queries, truncate at Sept 2024 or note the incompleteness. For aggregate totals (e.g. "total spending in 2024"), include all available data but note that Oct-Dec figures are partial
- Remote Patient Monitoring (RPM) and Chronic Care Management (CCM) are rapidly growing categories
- Provider types matter: Organizations vs Individual providers show different spending patterns
- CRITICAL: Beneficiary counts CANNOT be summed across HCPCS codes or providers because beneficiaries overlap between codes/providers. Only report beneficiary counts per individual code or per individual provider. Never produce a "total beneficiaries" by summing across codes or providers.`,
});
