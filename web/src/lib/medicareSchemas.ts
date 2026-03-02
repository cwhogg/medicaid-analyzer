export function generateMedicareSchemaPrompt(): string {
  return `## Medicare Physician & Other Practitioners — 2023

You have ONE table: **medicare** (~9.7M rows, 30 columns)

This is the CMS Medicare Provider Utilization and Payment dataset for Part B fee-for-service claims. Each row represents one provider (NPI) + one HCPCS procedure code + one place of service for the 2023 calendar year.

---

### CRITICAL: Payment Calculations

All payment columns are **averages per service**. To get totals, multiply by Tot_Srvcs:

\`\`\`sql
-- Total Medicare spending for a provider or code:
ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_medicare_payment

-- Total submitted charges:
ROUND(SUM(Avg_Sbmtd_Chrg * Tot_Srvcs), 0) AS total_submitted_charges

-- Total allowed amount:
ROUND(SUM(Avg_Mdcr_Alowd_Amt * Tot_Srvcs), 0) AS total_allowed
\`\`\`

---

### Columns

**Provider Identity:**
| Column | Type | Description |
|--------|------|-------------|
| Rndrng_NPI | VARCHAR | National Provider Identifier (10-digit) |
| Rndrng_Prvdr_Last_Org_Name | VARCHAR | Last name or organization name |
| Rndrng_Prvdr_First_Name | VARCHAR | First name (NULL for organizations) |
| Rndrng_Prvdr_MI | VARCHAR | Middle initial |
| Rndrng_Prvdr_Crdntls | VARCHAR | Credentials (e.g. 'M.D.', 'D.O.', 'N.P.') |
| Rndrng_Prvdr_Ent_Cd | VARCHAR | Entity type: 'I'=Individual, 'O'=Organization |
| Rndrng_Prvdr_Type | VARCHAR | Provider specialty (e.g. 'Internal Medicine', 'Cardiology', 'Nurse Practitioner') |
| Rndrng_Prvdr_Mdcr_Prtcptg_Ind | VARCHAR | Medicare participating provider: 'Y' or 'N' |

**Provider Location:**
| Column | Type | Description |
|--------|------|-------------|
| Rndrng_Prvdr_St1 | VARCHAR | Street address line 1 |
| Rndrng_Prvdr_St2 | VARCHAR | Street address line 2 |
| Rndrng_Prvdr_City | VARCHAR | City |
| Rndrng_Prvdr_State_Abrvtn | VARCHAR | State abbreviation (e.g. 'CA', 'NY') |
| Rndrng_Prvdr_State_FIPS | VARCHAR | State FIPS code |
| Rndrng_Prvdr_Zip5 | VARCHAR | 5-digit ZIP code |
| Rndrng_Prvdr_RUCA | VARCHAR | Rural-Urban Commuting Area code |
| Rndrng_Prvdr_RUCA_Desc | VARCHAR | RUCA description (e.g. 'Metropolitan', 'Micropolitan', 'Small town', 'Rural') |
| Rndrng_Prvdr_Cntry | VARCHAR | Country code (mostly 'US') |

**Service:**
| Column | Type | Description |
|--------|------|-------------|
| HCPCS_Cd | VARCHAR | HCPCS/CPT procedure code |
| HCPCS_Desc | VARCHAR | Procedure description (e.g. 'Office/outpatient visit est') |
| HCPCS_Drug_Ind | VARCHAR | Drug indicator: 'Y'=drug/biological, 'N'=non-drug |
| Place_Of_Srvc | VARCHAR | Place of service: 'F'=Facility (hospital outpatient), 'O'=Office/non-facility |

**Volume & Payment:**
| Column | Type | Description |
|--------|------|-------------|
| Tot_Benes | INTEGER | Number of unique Medicare beneficiaries (minimum 11 per row) |
| Tot_Srvcs | DOUBLE | Total number of services rendered |
| Tot_Bene_Day_Srvcs | DOUBLE | Total distinct beneficiary/day services |
| Avg_Sbmtd_Chrg | DOUBLE | Average submitted charge per service (what the provider billed) |
| Avg_Mdcr_Alowd_Amt | DOUBLE | Average Medicare allowed amount per service (negotiated rate) |
| Avg_Mdcr_Pymt_Amt | DOUBLE | Average Medicare payment per service (what Medicare actually paid) |
| Avg_Mdcr_Stdzd_Amt | DOUBLE | Average standardized payment (geographic wage adjustment removed — use for cross-region comparison) |

**Year:**
| Column | Type | Description |
|--------|------|-------------|
| data_year | INTEGER | Year of data (2023) |

---

### Query Patterns

**Top providers by total Medicare spending:**
\`\`\`sql
SELECT
  Rndrng_NPI,
  Rndrng_Prvdr_Last_Org_Name AS provider_name,
  Rndrng_Prvdr_First_Name AS first_name,
  Rndrng_Prvdr_Type AS specialty,
  Rndrng_Prvdr_State_Abrvtn AS state,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_medicare_payment,
  SUM(Tot_Srvcs) AS total_services
FROM medicare
WHERE Rndrng_Prvdr_Ent_Cd = 'I'
GROUP BY Rndrng_NPI, provider_name, first_name, specialty, state
ORDER BY total_medicare_payment DESC
LIMIT 20
\`\`\`

**Top HCPCS codes by spending:**
\`\`\`sql
SELECT
  HCPCS_Cd,
  HCPCS_Desc,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment,
  SUM(Tot_Srvcs) AS total_services,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 2) AS avg_payment_per_service
FROM medicare
GROUP BY HCPCS_Cd, HCPCS_Desc
ORDER BY total_payment DESC
LIMIT 20
\`\`\`

**Spending by specialty:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_Type AS specialty,
  COUNT(DISTINCT Rndrng_NPI) AS providers,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment,
  SUM(Tot_Srvcs) AS total_services
FROM medicare
GROUP BY specialty
ORDER BY total_payment DESC
LIMIT 20
\`\`\`

**State-level analysis:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_State_Abrvtn AS state,
  COUNT(DISTINCT Rndrng_NPI) AS providers,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment
FROM medicare
WHERE Rndrng_Prvdr_Cntry = 'US'
GROUP BY state
ORDER BY total_payment DESC
\`\`\`

**Charge vs payment markup analysis:**
\`\`\`sql
SELECT
  HCPCS_Cd,
  HCPCS_Desc,
  ROUND(AVG(Avg_Sbmtd_Chrg), 2) AS avg_charge,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 2) AS avg_payment,
  ROUND(AVG(Avg_Sbmtd_Chrg) / NULLIF(AVG(Avg_Mdcr_Pymt_Amt), 0), 1) AS charge_to_payment_ratio,
  SUM(Tot_Srvcs) AS total_services
FROM medicare
GROUP BY HCPCS_Cd, HCPCS_Desc
HAVING SUM(Tot_Srvcs) > 10000
ORDER BY charge_to_payment_ratio DESC
LIMIT 20
\`\`\`

**Drug vs non-drug spending:**
\`\`\`sql
SELECT
  CASE HCPCS_Drug_Ind WHEN 'Y' THEN 'Drug/Biological' ELSE 'Non-Drug Service' END AS category,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment,
  SUM(Tot_Srvcs) AS total_services,
  COUNT(DISTINCT HCPCS_Cd) AS unique_codes
FROM medicare
GROUP BY category
\`\`\`

**Facility vs office comparison:**
\`\`\`sql
SELECT
  CASE Place_Of_Srvc WHEN 'F' THEN 'Facility' WHEN 'O' THEN 'Office' ELSE Place_Of_Srvc END AS setting,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment,
  SUM(Tot_Srvcs) AS total_services,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 2) AS avg_payment_per_service
FROM medicare
GROUP BY setting
\`\`\`

**Rural vs urban analysis:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_RUCA_Desc AS area_type,
  COUNT(DISTINCT Rndrng_NPI) AS providers,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs), 0) AS total_payment
FROM medicare
WHERE Rndrng_Prvdr_RUCA_Desc IS NOT NULL
GROUP BY area_type
ORDER BY total_payment DESC
\`\`\`

---

### Performance Rules (CRITICAL — 9.7M rows)
- ALWAYS use GROUP BY to aggregate. Never SELECT * FROM medicare without aggregation.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- Keep queries simple — prefer a single scan with GROUP BY.
- Avoid subqueries when a single GROUP BY suffices.

### Data Integrity Rules
- NEVER fabricate, hardcode, or invent data values.
- If the question cannot be answered, respond with CANNOT_ANSWER: followed by a clear explanation.
- CRITICAL: Tot_Benes CANNOT be summed across HCPCS codes or providers because beneficiaries overlap. Only report beneficiary counts per individual code or per individual provider. Never SUM(Tot_Benes) across codes or providers.
- All payment columns are per-service AVERAGES. Always multiply by Tot_Srvcs for totals.
- Privacy: providers with <11 beneficiaries for a given HCPCS code are excluded entirely.

### Important Notes
- This is Medicare Part B (physician/professional services) fee-for-service claims ONLY.
- It does NOT include: Part A (hospital inpatient DRG), Part C (Medicare Advantage), Part D (prescription drugs).
- Provider info is inline — no need to JOIN a separate lookup table. Use Rndrng_Prvdr_Last_Org_Name directly.
- HCPCS descriptions are inline — use HCPCS_Desc directly, no separate lookup needed.
- Use Rndrng_Prvdr_State_Abrvtn for state-level analysis (no JOIN needed).
- Use Rndrng_Prvdr_Type for specialty analysis (~100 categories).
- Avg_Mdcr_Stdzd_Amt removes geographic wage index — use this for fair cross-region comparisons.
- Place_Of_Srvc splits facility vs office — the same procedure often has different payment rates in each setting.
- Round dollar amounts with ROUND(..., 0) — no cents.
- Only generate SELECT statements. Use DuckDB SQL syntax.
`;
}
