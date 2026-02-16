export interface TableSchema {
  name: string;
  description: string;
  columns: { name: string; type: string; description: string }[];
}

export const TABLE_SCHEMAS: TableSchema[] = [
  {
    name: "claims",
    description:
      "Raw Medicaid provider spending data. 227 million rows, one per provider+procedure+month combination. Covers Jan 2018 – Dec 2024. This is the primary data table.",
    columns: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit NPI number)" },
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code (e.g. '99213', 'J0178')" },
      { name: "claim_month", type: "DATE", description: "Month of claims (first day of month, e.g. 2024-01-01)" },
      { name: "total_paid", type: "DOUBLE", description: "Total Medicaid payments in dollars" },
      { name: "total_claims", type: "BIGINT", description: "Total number of claims" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Number of unique beneficiaries" },
    ],
  },
  {
    name: "hcpcs_lookup",
    description:
      "Lookup table mapping HCPCS/CPT codes to their English descriptions. ~17.5K rows. JOIN this with claims on hcpcs_code to get human-readable procedure names.",
    columns: [
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code" },
      { name: "description", type: "VARCHAR", description: "Short English description of the procedure (e.g. 'Office o/p est low 20 min')" },
    ],
  },
  {
    name: "npi_lookup",
    description:
      "Lookup table mapping billing NPI numbers to provider names, type, and location. ~615K rows. JOIN this with claims on billing_npi to get human-readable provider names.",
    columns: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit)" },
      { name: "provider_name", type: "VARCHAR", description: "Provider or organization name (e.g. 'PUBLIC PARTNERSHIPS LLC', 'John Smith')" },
      { name: "provider_type", type: "VARCHAR", description: "'Individual' or 'Organization'" },
      { name: "city", type: "VARCHAR", description: "Practice location city" },
      { name: "state", type: "VARCHAR", description: "Practice location state (2-letter abbreviation)" },
    ],
  },
  {
    name: "state_population",
    description:
      "Lookup table with US state population and Medicaid enrollment figures (2023 Census estimates). 52 rows (50 states + DC + PR). JOIN with npi_lookup on state for per-capita calculations.",
    columns: [
      { name: "state", type: "VARCHAR", description: "2-letter state abbreviation (e.g. 'CA', 'NY')" },
      { name: "state_name", type: "VARCHAR", description: "Full state name (e.g. 'California')" },
      { name: "population_2023", type: "BIGINT", description: "Total state population (2023 Census estimate)" },
      { name: "medicaid_enrollment_2023", type: "BIGINT", description: "Medicaid enrollment count (2023)" },
    ],
  },
];

export function generateSchemaPrompt(): string {
  let prompt = "You have access to the following Medicaid provider spending tables (Jan 2018 – Sep 2024; Oct-Dec 2024 excluded — incomplete data):\n\n";

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

  prompt += `## Query patterns:

### Monthly/yearly trends
\`\`\`sql
SELECT date_trunc('month', claim_month) AS month, SUM(total_paid) AS spending
FROM claims
GROUP BY month ORDER BY month
\`\`\`

### Top providers
\`\`\`sql
SELECT c.billing_npi, n.provider_name, n.state, SUM(c.total_paid) AS total_spending
FROM claims c
LEFT JOIN npi_lookup n ON c.billing_npi = n.billing_npi
GROUP BY c.billing_npi, n.provider_name, n.state
ORDER BY total_spending DESC LIMIT 20
\`\`\`

### Top procedures
\`\`\`sql
SELECT c.hcpcs_code, l.description, SUM(c.total_paid) AS total_spending
FROM claims c
LEFT JOIN hcpcs_lookup l ON c.hcpcs_code = l.hcpcs_code
GROUP BY c.hcpcs_code, l.description
ORDER BY total_spending DESC LIMIT 20
\`\`\`

### State-level analysis
\`\`\`sql
SELECT n.state, SUM(c.total_paid) AS total_spending
FROM claims c
JOIN npi_lookup n ON c.billing_npi = n.billing_npi
GROUP BY n.state
ORDER BY total_spending DESC
\`\`\`

### Per-capita / per-enrollee analysis
\`\`\`sql
SELECT n.state, sp.state_name, sp.population_2023,
  SUM(c.total_paid) AS total_spending,
  ROUND(SUM(c.total_paid) / sp.population_2023, 2) AS spending_per_capita,
  ROUND(SUM(c.total_paid) / sp.medicaid_enrollment_2023, 2) AS spending_per_enrollee
FROM claims c
JOIN npi_lookup n ON c.billing_npi = n.billing_npi
JOIN state_population sp ON n.state = sp.state
GROUP BY n.state, sp.state_name, sp.population_2023, sp.medicaid_enrollment_2023
ORDER BY spending_per_capita DESC
\`\`\`

### Provider + procedure detail
\`\`\`sql
SELECT c.hcpcs_code, l.description, SUM(c.total_paid) AS spending
FROM claims c
LEFT JOIN hcpcs_lookup l ON c.hcpcs_code = l.hcpcs_code
WHERE c.billing_npi = '1234567890'
GROUP BY c.hcpcs_code, l.description
ORDER BY spending DESC LIMIT 20
\`\`\`

## Performance rules (CRITICAL — the claims table has 227M rows):
- ALWAYS use GROUP BY to aggregate. Never SELECT * FROM claims without aggregation.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For time series, use date_trunc('month', claim_month) or date_trunc('year', claim_month) and GROUP BY.
- When filtering by year, use: WHERE claim_month >= '2024-01-01' AND claim_month < '2025-01-01'
- Keep queries simple. Prefer a single scan of claims + lookup joins.
- Avoid subqueries on claims when a single GROUP BY suffices.

## CRITICAL — Data integrity rules:
- NEVER fabricate, hardcode, or invent data values. Every number in your SQL must come from the tables.
- NEVER use hardcoded UNION ALL constructs with literal values to simulate data that doesn't exist in the tables.
- If the available tables cannot answer the user's question, respond with CANNOT_ANSWER: followed by a clear explanation of what data is and is not available, rather than generating a query with made-up numbers.
- The dataset contains ONLY: billing NPI, HCPCS code, claim month, total paid, total claims, and unique beneficiaries. It does NOT contain: diagnosis codes, patient demographics, drug names (only J-codes), facility types, payer types, or clinical outcomes.
- COVERAGE LIMITATION: This dataset covers HCPCS/CPT-billed claims only. It includes physician/professional fees (including those rendered in hospitals), outpatient services, drugs (J-codes), DME, personal care, and behavioral health. It does NOT include DRG-based hospital facility payments (room & board, OR fees, hospital overhead). Inpatient physician services (admission 99221-99223, subsequent care 99231-99233, discharge 99238-99239) ARE included, but the facility component of hospital stays is NOT. When discussing "total Medicaid spending," note that hospital facility costs are excluded from this dataset.

## Important notes:
- All tables are registered as views. Query them directly by name (e.g. SELECT ... FROM claims).
- Date columns are DATE type. Use date functions like EXTRACT(YEAR FROM claim_month), date_trunc('year', claim_month), etc.
- Dollar amounts are in raw USD (not thousands/millions). Always round to whole dollars with ROUND(..., 0) — never show cents.
- Always include a LIMIT clause (max 10000 rows).
- Only generate SELECT statements. No DDL or DML.
- Use DuckDB SQL syntax (not PostgreSQL or MySQL).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- ALWAYS JOIN with hcpcs_lookup to include human-readable descriptions when returning HCPCS codes. Use LEFT JOIN so codes without descriptions still appear.
- Show the description column right after the hcpcs_code column for readability.
- ALWAYS JOIN with npi_lookup to include provider names when returning billing_npi. Use LEFT JOIN so NPIs without names still appear.
- Show the provider_name column right after the billing_npi column for readability.
- For geographic/state questions, JOIN claims with npi_lookup to get the provider's state.
- Use short, distinct table aliases (e.g. c for claims, l for hcpcs_lookup, n for npi_lookup).

## Searching for procedures by topic:
- ALWAYS filter by hcpcs_code ranges or specific codes, NOT by description text. The descriptions are cleaned-up labels and may not match keyword searches.
- Common HCPCS code families:
  - Personal Care Services: T1019 (per 15 min), T1020 (per diem) — T1019 is the LARGEST single code in Medicaid by total spending (~$122B). Do NOT confuse with Principal Care Management (PCM).
  - Clinic / Rehabilitation Services: T1015 (clinic service), T2016 (habilitation residential waiver per diem), T2003 (non-emergency transport)
  - Principal Care Management (PCM): 99424, 99425, 99426, 99427 — physician management of a single chronic condition. Much smaller than Personal Care Services.
  - Remote Patient Monitoring (RPM): 99453, 99454, 99457, 99458, 99473, 99474 (99454 is the device/data transmission code, 99457/99458 are treatment management)
  - Chronic Care Management (CCM): 99490, 99491, 99437, 99439
  - Evaluation & Management (E/M) office visits: 99202-99215 (99211-99215 are established, 99202-99205 are new)
  - Telehealth: 99441-99443 (phone), 99421-99423 (online digital)
  - Behavioral Health Integration: 99484, 99492, 99493, 99494
  - Annual Wellness Visit: G0438 (initial), G0439 (subsequent)
  - Transitional Care Management: 99495, 99496
- IMPORTANT: T-codes (T1019, T1015, T2016, etc.) are Medicaid-specific temporary codes and represent the highest-spending categories. They are NOT the same as CPT codes like 99424-99427.
- When the user asks about a category (e.g. "RPM", "telehealth", "CCM", "personal care"), use WHERE hcpcs_code IN (...) with the appropriate code list above.
- For drug/injection queries, J-codes start with 'J' — use WHERE hcpcs_code LIKE 'J%' or specific J-codes.
- For DME/supply queries, use A-codes (LIKE 'A%'), E-codes (LIKE 'E%'), or L-codes (LIKE 'L%').
- For Medicaid-specific services, T-codes start with 'T' — use WHERE hcpcs_code LIKE 'T%' or specific T-codes.
`;

  return prompt;
}
