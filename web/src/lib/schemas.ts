export interface TableSchema {
  name: string;
  description: string;
  columns: { name: string; type: string; description: string }[];
}

export const TABLE_SCHEMAS: TableSchema[] = [
  {
    name: "monthly_totals",
    description:
      "Overall monthly spending totals across all providers and procedures. 84 rows, one per month from Jan 2018 to Dec 2024.",
    columns: [
      { name: "claim_month", type: "DATE", description: "Month of claims (first day of month, e.g. 2024-01-01)" },
      { name: "total_paid", type: "DOUBLE", description: "Total Medicaid payments in dollars for the month" },
      { name: "total_claims", type: "BIGINT", description: "Total number of claims in the month" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Number of unique beneficiaries in the month" },
      { name: "unique_providers", type: "INTEGER", description: "Number of unique billing providers in the month" },
      { name: "unique_hcpcs_codes", type: "INTEGER", description: "Number of unique HCPCS procedure codes used" },
    ],
  },
  {
    name: "hcpcs_summary",
    description:
      "Aggregated spending by HCPCS procedure code across all time. ~10.9K rows, one per HCPCS code.",
    columns: [
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code (e.g. '99213', 'J0178')" },
      { name: "total_paid", type: "DOUBLE", description: "Total Medicaid payments for this procedure code" },
      { name: "total_claims", type: "BIGINT", description: "Total claims for this procedure code" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Unique beneficiaries who received this procedure" },
      { name: "unique_providers", type: "INTEGER", description: "Unique providers who billed this procedure" },
      { name: "first_month", type: "DATE", description: "First month this code appears in data" },
      { name: "last_month", type: "DATE", description: "Last month this code appears in data" },
    ],
  },
  {
    name: "hcpcs_monthly",
    description:
      "Monthly spending breakdown by HCPCS procedure code. ~536K rows. Use this for procedure-level time trends.",
    columns: [
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code" },
      { name: "claim_month", type: "DATE", description: "Month of claims" },
      { name: "total_paid", type: "DOUBLE", description: "Total payments for this code in this month" },
      { name: "total_claims", type: "BIGINT", description: "Total claims for this code in this month" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Unique beneficiaries for this code in this month" },
      { name: "unique_providers", type: "INTEGER", description: "Unique providers billing this code in this month" },
    ],
  },
  {
    name: "provider_summary",
    description:
      "Aggregated spending by billing provider NPI across all time. ~617K rows, one per provider.",
    columns: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit NPI number)" },
      { name: "total_paid", type: "DOUBLE", description: "Total Medicaid payments to this provider" },
      { name: "total_claims", type: "BIGINT", description: "Total claims billed by this provider" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Unique beneficiaries seen by this provider" },
      { name: "unique_hcpcs_codes", type: "INTEGER", description: "Unique procedure codes billed by this provider" },
      { name: "first_month", type: "DATE", description: "First month this provider appears" },
      { name: "last_month", type: "DATE", description: "Last month this provider appears" },
    ],
  },
  {
    name: "top_providers_monthly",
    description:
      "Monthly spending detail for the top 1,000 providers by total spending. ~82K rows. Use for provider-level time trends.",
    columns: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier" },
      { name: "claim_month", type: "DATE", description: "Month of claims" },
      { name: "total_paid", type: "DOUBLE", description: "Total payments for this provider in this month" },
      { name: "total_claims", type: "BIGINT", description: "Total claims for this provider in this month" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Unique beneficiaries for this provider in this month" },
      { name: "unique_hcpcs_codes", type: "INTEGER", description: "Unique procedure codes billed in this month" },
    ],
  },
  {
    name: "hcpcs_lookup",
    description:
      "Lookup table mapping HCPCS/CPT codes to their English descriptions. ~17.5K rows. JOIN this with other tables on hcpcs_code to get human-readable procedure names.",
    columns: [
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code" },
      { name: "description", type: "VARCHAR", description: "Short English description of the procedure (e.g. 'Office o/p est low 20 min')" },
    ],
  },
  {
    name: "npi_lookup",
    description:
      "Lookup table mapping billing NPI numbers to provider names, type, and location. ~615K rows. JOIN this with other tables on billing_npi to get human-readable provider names.",
    columns: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit)" },
      { name: "provider_name", type: "VARCHAR", description: "Provider or organization name (e.g. 'PUBLIC PARTNERSHIPS LLC', 'John Smith')" },
      { name: "provider_type", type: "VARCHAR", description: "'Individual' or 'Organization'" },
      { name: "city", type: "VARCHAR", description: "Practice location city" },
      { name: "state", type: "VARCHAR", description: "Practice location state (2-letter abbreviation)" },
    ],
  },
];

export function generateSchemaPrompt(): string {
  let prompt = "You have access to the following pre-aggregated Medicaid provider spending tables (Jan 2018 – Dec 2024):\n\n";

  for (const table of TABLE_SCHEMAS) {
    prompt += `## Table: ${table.name}\n`;
    prompt += `${table.description}\n\n`;
    prompt += "| Column | Type | Description |\n";
    prompt += "|--------|------|-------------|\n";
    for (const col of table.columns) {
      prompt += `| ${col.name} | ${col.type} | ${col.description} |\n`;
    }
    prompt += "\n";
  }

  prompt += `## CRITICAL column availability:
- billing_npi is ONLY in: provider_summary, top_providers_monthly, npi_lookup
- hcpcs_code is ONLY in: hcpcs_summary, hcpcs_monthly, hcpcs_lookup
- claim_month is in: monthly_totals, hcpcs_monthly, top_providers_monthly
- hcpcs_monthly does NOT have billing_npi. It has: hcpcs_code, claim_month, total_paid, total_claims, unique_beneficiaries, unique_providers
- monthly_totals does NOT have billing_npi or hcpcs_code
- provider_summary does NOT have hcpcs_code or claim_month
- The unique_providers column in hcpcs_monthly and hcpcs_summary is a pre-computed COUNT of distinct providers. Use it directly instead of trying to COUNT(DISTINCT billing_npi).

## Join rules (CRITICAL for performance):
- NEVER join top_providers_monthly with hcpcs_monthly — they share no meaningful key and will create a Cartesian product.
- NEVER join provider_summary with hcpcs_summary — same problem, no shared key.
- The ONLY valid joins are with the lookup tables: hcpcs_lookup (on hcpcs_code) and npi_lookup (on billing_npi).
- To answer "how many providers billed X procedure", use the unique_providers column from hcpcs_summary or hcpcs_monthly. Do NOT try to count distinct billing_npi from other tables.
- Keep queries simple. Prefer querying a single data table + lookup joins.

## Important notes:
- All tables are registered in DuckDB as views. Query them directly by name (e.g. SELECT * FROM monthly_totals).
- Date columns are DATE type. Use date functions like EXTRACT(YEAR FROM claim_month), date_trunc('year', claim_month), etc.
- Dollar amounts are in raw USD (not thousands/millions). Format large values with ROUND() as needed.
- Always include a LIMIT clause (max 10000 rows).
- Only generate SELECT statements. No DDL or DML.
- Use DuckDB SQL syntax (not PostgreSQL or MySQL).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- When asked about trends over time, prefer monthly_totals or hcpcs_monthly tables.
- When asked about specific providers, use provider_summary or top_providers_monthly.
- When asked about specific procedures/HCPCS codes, use hcpcs_summary or hcpcs_monthly.
- ALWAYS JOIN with hcpcs_lookup to include human-readable descriptions when returning HCPCS codes. Use LEFT JOIN so codes without descriptions still appear. Example: SELECT h.hcpcs_code, l.description, h.total_paid FROM hcpcs_summary h LEFT JOIN hcpcs_lookup l ON h.hcpcs_code = l.hcpcs_code
- Show the description column right after the hcpcs_code column for readability.
- ALWAYS JOIN with npi_lookup to include provider names when returning billing_npi. Use LEFT JOIN so NPIs without names still appear. Example: SELECT p.billing_npi, n.provider_name, p.total_paid FROM provider_summary p LEFT JOIN npi_lookup n ON p.billing_npi = n.billing_npi
- Show the provider_name column right after the billing_npi column for readability.

## Searching for procedures by topic:
- ALWAYS filter by hcpcs_code ranges or specific codes, NOT by description text. The descriptions are cleaned-up labels and may not match keyword searches.
- Common HCPCS code families:
  - Remote Patient Monitoring (RPM): 99453, 99454, 99457, 99458, 99473, 99474 (99454 is the device/data transmission code, 99457/99458 are treatment management)
  - Chronic Care Management (CCM): 99490, 99491, 99437, 99439
  - Evaluation & Management (E/M) office visits: 99202-99215 (99211-99215 are established, 99202-99205 are new)
  - Telehealth: 99441-99443 (phone), 99421-99423 (online digital)
  - Behavioral Health Integration: 99484, 99492, 99493, 99494
  - Annual Wellness Visit: G0438 (initial), G0439 (subsequent)
  - Transitional Care Management: 99495, 99496
- When the user asks about a category (e.g. "RPM", "telehealth", "CCM"), use WHERE hcpcs_code IN (...) with the appropriate code list above.
- For drug/injection queries, J-codes start with 'J' — use WHERE hcpcs_code LIKE 'J%' or specific J-codes.
- For DME/supply queries, use A-codes (LIKE 'A%'), E-codes (LIKE 'E%'), or L-codes (LIKE 'L%').
`;

  return prompt;
}
