export function generateMedicareInpatientSchemaPrompt(): string {
  return `## Medicare Inpatient Hospitals — by Provider and Service (2013-2023)

You have ONE table: **medicare_inpatient** (~2M rows, 16 columns)

This is the CMS Medicare Inpatient Hospitals dataset. Each row represents one hospital (identified by CCN) + one DRG (Diagnosis Related Group) code for a single calendar year. Data spans 11 years (2013-2023). It covers Original Medicare Part A fee-for-service inpatient hospital discharges from IPPS (Inpatient Prospective Payment System) hospitals only.

---

### CRITICAL: Payment Calculations

All payment columns are **averages per discharge**. To get totals, multiply by Tot_Dschrgs:

\`\`\`sql
-- Total Medicare payment for a hospital or DRG:
ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment

-- Total submitted charges:
ROUND(SUM(Avg_Submtd_Cvrd_Chrg * Tot_Dschrgs), 0) AS total_submitted_charges

-- Total payment (includes Medicare + beneficiary coinsurance + deductible + outlier):
ROUND(SUM(Avg_Tot_Pymt_Amt * Tot_Dschrgs), 0) AS total_payment
\`\`\`

---

### Columns

**Hospital Identity:**
| Column | Type | Description |
|--------|------|-------------|
| Rndrng_Prvdr_CCN | VARCHAR | CMS Certification Number (6-digit hospital identifier) |
| Rndrng_Prvdr_Org_Name | VARCHAR | Hospital name (e.g. 'Southeast Health Medical Center', 'Mayo Clinic') |

**Hospital Location:**
| Column | Type | Description |
|--------|------|-------------|
| Rndrng_Prvdr_St | VARCHAR | Street address |
| Rndrng_Prvdr_City | VARCHAR | City |
| Rndrng_Prvdr_State_Abrvtn | VARCHAR | State abbreviation (e.g. 'CA', 'NY') |
| Rndrng_Prvdr_State_FIPS | VARCHAR | State FIPS code |
| Rndrng_Prvdr_Zip5 | VARCHAR | 5-digit ZIP code |
| Rndrng_Prvdr_RUCA | VARCHAR | Rural-Urban Commuting Area code |
| Rndrng_Prvdr_RUCA_Desc | VARCHAR | RUCA description (e.g. 'Metropolitan', 'Micropolitan', 'Small town', 'Rural') |

**Diagnosis Related Group (DRG):**
| Column | Type | Description |
|--------|------|-------------|
| DRG_Cd | VARCHAR | MS-DRG code (3-digit, e.g. '003', '470', '871') |
| DRG_Desc | VARCHAR | DRG description (e.g. 'MAJOR JOINT REPLACEMENT OR REATTACHMENT OF LOWER EXTREMITY W/O MCC') |

**Volume & Payment:**
| Column | Type | Description |
|--------|------|-------------|
| Tot_Dschrgs | INTEGER | Total number of discharges (minimum 11 per row for privacy) |
| Avg_Submtd_Cvrd_Chrg | DOUBLE | Average submitted covered charge per discharge (what the hospital billed) |
| Avg_Tot_Pymt_Amt | DOUBLE | Average total payment per discharge (Medicare + beneficiary deductible + coinsurance + outlier payments) |
| Avg_Mdcr_Pymt_Amt | DOUBLE | Average Medicare payment per discharge (what Medicare actually paid — excludes beneficiary cost-sharing) |

**Year:**
| Column | Type | Description |
|--------|------|-------------|
| data_year | INTEGER | Year of data (2013-2023) |

---

### Query Patterns

**Top hospitals by total Medicare inpatient spending:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_CCN,
  Rndrng_Prvdr_Org_Name AS hospital,
  Rndrng_Prvdr_State_Abrvtn AS state,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment,
  SUM(Tot_Dschrgs) AS total_discharges
FROM medicare_inpatient
GROUP BY Rndrng_Prvdr_CCN, hospital, state
ORDER BY total_medicare_payment DESC
LIMIT 20
\`\`\`

**Top DRGs by spending:**
\`\`\`sql
SELECT
  DRG_Cd,
  DRG_Desc,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment,
  SUM(Tot_Dschrgs) AS total_discharges,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 0) AS avg_payment_per_discharge
FROM medicare_inpatient
GROUP BY DRG_Cd, DRG_Desc
ORDER BY total_medicare_payment DESC
LIMIT 20
\`\`\`

**Year-over-year spending trend:**
\`\`\`sql
SELECT
  data_year,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment,
  SUM(Tot_Dschrgs) AS total_discharges,
  COUNT(DISTINCT Rndrng_Prvdr_CCN) AS hospitals
FROM medicare_inpatient
GROUP BY data_year
ORDER BY data_year
\`\`\`

**State-level analysis:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_State_Abrvtn AS state,
  COUNT(DISTINCT Rndrng_Prvdr_CCN) AS hospitals,
  SUM(Tot_Dschrgs) AS total_discharges,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment
FROM medicare_inpatient
GROUP BY state
ORDER BY total_medicare_payment DESC
LIMIT 20
\`\`\`

**Charge-to-payment ratio by DRG:**
\`\`\`sql
SELECT
  DRG_Cd,
  DRG_Desc,
  ROUND(AVG(Avg_Submtd_Cvrd_Chrg), 0) AS avg_charge,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 0) AS avg_payment,
  ROUND(AVG(Avg_Submtd_Cvrd_Chrg) / NULLIF(AVG(Avg_Mdcr_Pymt_Amt), 0), 1) AS charge_to_payment_ratio,
  SUM(Tot_Dschrgs) AS total_discharges
FROM medicare_inpatient
GROUP BY DRG_Cd, DRG_Desc
HAVING SUM(Tot_Dschrgs) > 1000
ORDER BY charge_to_payment_ratio DESC
LIMIT 20
\`\`\`

**Compare hospital pricing for same DRG:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_Org_Name AS hospital,
  Rndrng_Prvdr_State_Abrvtn AS state,
  Tot_Dschrgs AS discharges,
  ROUND(Avg_Submtd_Cvrd_Chrg, 0) AS avg_charge,
  ROUND(Avg_Mdcr_Pymt_Amt, 0) AS avg_medicare_payment,
  ROUND(Avg_Tot_Pymt_Amt, 0) AS avg_total_payment
FROM medicare_inpatient
WHERE DRG_Cd = '470' AND data_year = 2023
ORDER BY Avg_Submtd_Cvrd_Chrg DESC
LIMIT 20
\`\`\`

**Rural vs urban spending:**
\`\`\`sql
SELECT
  Rndrng_Prvdr_RUCA_Desc AS area_type,
  COUNT(DISTINCT Rndrng_Prvdr_CCN) AS hospitals,
  SUM(Tot_Dschrgs) AS total_discharges,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 0) AS avg_payment_per_discharge
FROM medicare_inpatient
WHERE Rndrng_Prvdr_RUCA_Desc IS NOT NULL
GROUP BY area_type
ORDER BY total_medicare_payment DESC
\`\`\`

**Spending trend for a specific DRG:**
\`\`\`sql
SELECT
  data_year,
  SUM(Tot_Dschrgs) AS total_discharges,
  ROUND(AVG(Avg_Mdcr_Pymt_Amt), 0) AS avg_payment_per_discharge,
  ROUND(SUM(Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), 0) AS total_medicare_payment
FROM medicare_inpatient
WHERE DRG_Cd = '470'
GROUP BY data_year
ORDER BY data_year
\`\`\`

---

### Performance Rules (CRITICAL — ~2M rows)
- ALWAYS use GROUP BY to aggregate. Never SELECT * FROM medicare_inpatient without aggregation.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- For year-specific queries, always filter with WHERE data_year = <year> to reduce scan size.

### Data Integrity Rules
- NEVER fabricate, hardcode, or invent data values.
- If the question cannot be answered, respond with CANNOT_ANSWER: followed by a clear explanation.
- All payment columns are per-discharge AVERAGES. Always multiply by Tot_Dschrgs for totals.
- Privacy: hospitals with fewer than 11 discharges for a given DRG are excluded entirely.

### Important Notes
- This is Medicare Part A inpatient hospital data ONLY. It uses DRG codes (not HCPCS/CPT).
- It does NOT include: Part B (physician services), Part C (Medicare Advantage), Part D (prescription drugs), outpatient hospital services.
- Hospitals are identified by CCN (CMS Certification Number), not NPI. CCN is a 6-digit code.
- Only IPPS (Inpatient Prospective Payment System) hospitals are included — excludes Critical Access Hospitals, children's hospitals, and other exempt facilities.
- DRG = Diagnosis Related Group. MS-DRG = Medicare Severity DRG. Higher severity = higher payment.
- Many DRGs come in pairs/triples distinguished by severity: "w MCC" (with Major Complication/Comorbidity), "w CC" (with Complication), "w/o CC/MCC" (without).
- Avg_Tot_Pymt_Amt includes Medicare payment + beneficiary deductible + coinsurance + outlier amounts. Avg_Mdcr_Pymt_Amt is the Medicare-only portion.
- The difference between Avg_Tot_Pymt_Amt and Avg_Mdcr_Pymt_Amt approximates the beneficiary out-of-pocket cost.
- Submitted charges (Avg_Submtd_Cvrd_Chrg) are the hospital's chargemaster prices — typically 3-5x what Medicare actually pays.
- Data spans 2013-2023 (11 years). Use data_year to filter by year or analyze trends.
- Round dollar amounts with ROUND(..., 0) — no cents.
- Only generate SELECT statements. Use DuckDB SQL syntax.
`;
}
