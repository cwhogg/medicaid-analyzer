export function generatePartDSchemaPrompt(): string {
  return `## Medicare Part D Prescribers — by Provider and Drug (2013-2023)

You have ONE table: **medicare_partd** (~276M rows, 23 columns)

This is the CMS Medicare Part D Prescribers dataset. Each row represents one prescriber (identified by NPI) + one drug (brand/generic name) for a single calendar year. Data spans 11 years (2013-2023). It covers prescription drugs prescribed by individual providers to Medicare Part D beneficiaries.

---

### CRITICAL: Cost and Volume Rules

- **Tot_Drug_Cst is a TOTAL** — it is the total drug cost for that prescriber+drug+year row. Do NOT multiply it by anything.
- **Tot_Clms, Tot_30day_Fills, Tot_Day_Suply, Tot_Benes are all TOTALS** per row. Use SUM() to aggregate across rows.
- To get average cost per claim: ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Clms), 0), 2)
- To get average cost per beneficiary: ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Benes), 0), 2)

---

### Columns

**Prescriber Identity:**
| Column | Type | Description |
|--------|------|-------------|
| Prscrbr_NPI | VARCHAR | National Provider Identifier (10-digit) |
| Prscrbr_Last_Org_Name | VARCHAR | Last name or organization name |
| Prscrbr_First_Name | VARCHAR | First name (NULL for organizations) |
| Prscrbr_City | VARCHAR | City |
| Prscrbr_State_Abrvtn | VARCHAR | State abbreviation (e.g. 'CA', 'NY') |
| Prscrbr_State_FIPS | VARCHAR | State FIPS code |
| Prscrbr_Type | VARCHAR | Provider specialty (e.g. 'Internal Medicine', 'Family Practice', 'Nurse Practitioner') |
| Prscrbr_Type_Src | VARCHAR | Source of specialty (S=Medicare enrollment, blank=NPPES) |

**Drug Identity:**
| Column | Type | Description |
|--------|------|-------------|
| Brnd_Name | VARCHAR | Brand name (NULL if generic-only drug) |
| Gnrc_Name | VARCHAR | Generic/chemical name (always populated) |

**All-Age Metrics (total values per prescriber+drug+year):**
| Column | Type | Description |
|--------|------|-------------|
| Tot_Clms | BIGINT | Total number of Medicare Part D claims |
| Tot_30day_Fills | DOUBLE | Total 30-day standardized fills |
| Tot_Day_Suply | BIGINT | Total day supply |
| Tot_Drug_Cst | DOUBLE | Total drug cost in dollars |
| Tot_Benes | BIGINT | Total unique beneficiaries |

**Age 65+ Metrics:**
| Column | Type | Description |
|--------|------|-------------|
| GE65_Sprsn_Flag | VARCHAR | '*' if age 65+ claims < 11 (values suppressed) |
| GE65_Tot_Clms | BIGINT | Age 65+ total claims (NULL if suppressed) |
| GE65_Tot_30day_Fills | DOUBLE | Age 65+ total 30-day fills (NULL if suppressed) |
| GE65_Tot_Day_Suply | BIGINT | Age 65+ total day supply (NULL if suppressed) |
| GE65_Tot_Drug_Cst | DOUBLE | Age 65+ total drug cost (NULL if suppressed) |
| GE65_Bene_Sprsn_Flag | VARCHAR | '*' if age 65+ beneficiaries < 11 (value suppressed) |
| GE65_Tot_Benes | BIGINT | Age 65+ total beneficiaries (NULL if suppressed) |

**Year:**
| Column | Type | Description |
|--------|------|-------------|
| data_year | INTEGER | Year of data (2013-2023) |

---

### Query Patterns

**Top 10 most prescribed drugs by total claims:**
\`\`\`sql
SELECT
  Gnrc_Name AS drug,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_cost,
  SUM(Tot_Benes) AS total_beneficiaries
FROM medicare_partd
WHERE data_year = 2023
GROUP BY Gnrc_Name
ORDER BY total_claims DESC
LIMIT 10
\`\`\`

**Top prescribers by total drug spending:**
\`\`\`sql
SELECT
  Prscrbr_NPI,
  Prscrbr_Last_Org_Name AS name,
  Prscrbr_First_Name AS first_name,
  Prscrbr_State_Abrvtn AS state,
  Prscrbr_Type AS specialty,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost,
  SUM(Tot_Clms) AS total_claims
FROM medicare_partd
WHERE data_year = 2023
GROUP BY Prscrbr_NPI, name, first_name, state, specialty
ORDER BY total_drug_cost DESC
LIMIT 20
\`\`\`

**Drug spending trends over time:**
\`\`\`sql
SELECT
  data_year,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost,
  SUM(Tot_Clms) AS total_claims,
  COUNT(DISTINCT Prscrbr_NPI) AS prescribers
FROM medicare_partd
GROUP BY data_year
ORDER BY data_year
\`\`\`

**State-level drug spending:**
\`\`\`sql
SELECT
  Prscrbr_State_Abrvtn AS state,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost,
  SUM(Tot_Clms) AS total_claims,
  COUNT(DISTINCT Prscrbr_NPI) AS prescribers
FROM medicare_partd
WHERE data_year = 2023
GROUP BY state
ORDER BY total_drug_cost DESC
LIMIT 20
\`\`\`

**Brand vs generic drug analysis:**
\`\`\`sql
SELECT
  CASE WHEN Brnd_Name IS NOT NULL THEN 'Brand' ELSE 'Generic' END AS drug_type,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_cost,
  ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Clms), 0), 2) AS cost_per_claim
FROM medicare_partd
WHERE data_year = 2023
GROUP BY drug_type
ORDER BY total_cost DESC
\`\`\`

**Most expensive drugs by cost per claim:**
\`\`\`sql
SELECT
  Gnrc_Name AS drug,
  Brnd_Name AS brand,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_cost,
  ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Clms), 0), 2) AS cost_per_claim
FROM medicare_partd
WHERE data_year = 2023
GROUP BY Gnrc_Name, Brnd_Name
HAVING SUM(Tot_Clms) > 1000
ORDER BY cost_per_claim DESC
LIMIT 20
\`\`\`

**Prescribing by specialty:**
\`\`\`sql
SELECT
  Prscrbr_Type AS specialty,
  COUNT(DISTINCT Prscrbr_NPI) AS prescribers,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost,
  ROUND(SUM(Tot_Drug_Cst) / NULLIF(COUNT(DISTINCT Prscrbr_NPI), 0), 0) AS cost_per_prescriber
FROM medicare_partd
WHERE data_year = 2023
GROUP BY specialty
ORDER BY total_drug_cost DESC
LIMIT 20
\`\`\`

**Opioid prescribing (common opioid generic names):**
\`\`\`sql
SELECT
  Gnrc_Name AS drug,
  data_year,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_cost,
  COUNT(DISTINCT Prscrbr_NPI) AS prescribers
FROM medicare_partd
WHERE LOWER(Gnrc_Name) IN ('oxycodone hcl', 'hydrocodone-acetaminophen', 'tramadol hcl', 'morphine sulfate', 'fentanyl', 'codeine-acetaminophen', 'oxycodone-acetaminophen', 'methadone hcl', 'buprenorphine hcl-naloxone')
GROUP BY drug, data_year
ORDER BY drug, data_year
\`\`\`

**Spending trend for a specific drug:**
\`\`\`sql
SELECT
  data_year,
  SUM(Tot_Clms) AS total_claims,
  ROUND(SUM(Tot_Drug_Cst), 0) AS total_cost,
  ROUND(SUM(Tot_Drug_Cst) / NULLIF(SUM(Tot_Clms), 0), 2) AS cost_per_claim,
  COUNT(DISTINCT Prscrbr_NPI) AS prescribers
FROM medicare_partd
WHERE LOWER(Gnrc_Name) LIKE '%atorvastatin%'
GROUP BY data_year
ORDER BY data_year
\`\`\`

---

### Performance Rules (CRITICAL — ~276M rows)
- ALWAYS use GROUP BY to aggregate. Never SELECT * FROM medicare_partd without aggregation.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- For year-specific queries, always filter with WHERE data_year = <year> to reduce scan size.
- For drug lookups, use LOWER() and LIKE for fuzzy matching on drug names.

### Data Integrity Rules
- NEVER fabricate, hardcode, or invent data values.
- If the question cannot be answered, respond with CANNOT_ANSWER: followed by a clear explanation.
- Tot_Drug_Cst is already a total — do NOT multiply it by claim count.
- Privacy: prescribers with fewer than 11 claims or beneficiaries for a drug are excluded entirely.
- GE65 columns are NULL when GE65_Sprsn_Flag = '*' (suppressed for privacy).

### Important Notes
- This is Medicare Part D prescription drug data ONLY.
- It does NOT include: Part A (inpatient hospital), Part B (physician services), Part C (Medicare Advantage), Medicaid, commercial insurance.
- Drug names: Gnrc_Name is the generic/chemical name (always populated). Brnd_Name is the brand name (NULL for generic-only drugs).
- To check if a drug is brand-name: WHERE Brnd_Name IS NOT NULL
- To check if a drug is generic-only: WHERE Brnd_Name IS NULL
- Prscrbr_Type contains specialty text like "Internal Medicine", "Family Practice", "Nurse Practitioner", "Physician Assistant", etc.
- Use Prscrbr_State_Abrvtn for state analysis (2-letter abbreviation).
- Data spans 2013-2023 (11 years). Use data_year to filter by year or analyze trends.
- Round dollar amounts with ROUND(..., 0) — no cents for totals, ROUND(..., 2) for per-unit costs.
- Only generate SELECT statements. Use DuckDB SQL syntax.
`;
}
