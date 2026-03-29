import { getDataset } from "@/lib/datasets/index";

// --- Multi-Dataset Preamble ---

export const MULTI_DATASET_PREAMBLE = `You are an expert data analyst working across multiple public health datasets. All datasets live in a single DuckDB instance — you can write cross-dataset JOINs, CTEs, and UNION queries freely.`;

// --- Multi-Dataset Rules ---

export const MULTI_DATASET_RULES = `## Cross-Dataset SQL Rules

- Always use table aliases and the EXACT column names from each dataset's schema. Column names differ across datasets (e.g., billing_npi in Medicaid, Rndrng_NPI in Medicare, Prscrbr_NPI in Part D).
- For JOINs on 100M+ row tables, ALWAYS aggregate each side in CTEs first, then join the aggregated results. Never write bare JOINs between fact tables.
- Always filter to overlapping years when joining datasets with different year ranges. Note year coverage limitations in results.
- Spending metrics differ across payers: Medicaid (total_paid), Medicare B (Avg_Mdcr_Pymt_Amt * Tot_Srvcs), Inpatient (Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), Part D (Tot_Drug_Cst). Compare trends, NOT sum across payers.
- Beneficiary counts CANNOT be summed across datasets, codes, or providers — beneficiaries overlap.
- Medicare Inpatient identifies hospitals by CCN (6-digit), NOT NPI. Cannot join to physician-level datasets on provider ID.
- BRFSS and NHANES are population surveys with NO provider identifiers. Cannot join to claims at row level. Can only compare aggregate statistics (e.g., state-level prevalence vs state-level spending).
- BRFSS uses FIPS codes for state (_STATE); claims/DAC use 2-letter abbreviations. Use CASE WHEN mapping to convert.
- DAC is a current snapshot (no year dimension). JOIN on NPI only, not time.
- Part D uses drug names (Gnrc_Name, Brnd_Name), NOT HCPCS codes.
- Specialty strings differ across datasets: DAC uses ALL CAPS ("INTERNAL MEDICINE"), Medicare uses mixed case. Normalize with UPPER() or LOWER() when joining on specialty.
- Each SQL query must be a valid DuckDB SELECT statement with a LIMIT clause (max 10000).`;

// --- Join Reference ---

const JOIN_REFERENCE = `## Cross-Dataset Join Reference

### Direct Joins (same identifier type)

| Join Key | Medicaid | Medicare B | Part D | DAC | Inpatient | BRFSS | NHANES |
|----------|----------|------------|--------|-----|-----------|-------|--------|
| NPI | billing_npi (VARCHAR) | Rndrng_NPI (VARCHAR) | Prscrbr_NPI (VARCHAR) | npi (VARCHAR) | N/A (uses CCN) | N/A | N/A |
| HCPCS code | hcpcs_code | HCPCS_Cd | N/A (uses drug names) | N/A | N/A (uses DRG_Cd) | N/A | N/A |
| State (2-letter) | npi_lookup.state | Rndrng_Prvdr_State_Abrvtn | Prscrbr_State_Abrvtn | state | Rndrng_Prvdr_State_Abrvtn | N/A (uses FIPS) | N/A |
| State (FIPS) | N/A | Rndrng_Prvdr_State_FIPS | Prscrbr_State_FIPS | N/A | Rndrng_Prvdr_State_FIPS | _STATE | N/A |
| Year | EXTRACT(YEAR FROM claim_month) | data_year (INT) | data_year (INT) | N/A (snapshot) | data_year (INT) | survey_year (INT) | N/A (single cycle) |
| Provider specialty | npi_lookup.provider_type | Rndrng_Prvdr_Type | Prscrbr_Type | pri_spec (ALL CAPS) | N/A | N/A | N/A |
| Gender | N/A | Rndrng_Prvdr_Gndr | N/A | gndr (M/F) | N/A | SEXVAR (1/2) | RIAGENDR (1/2) |

### Semantic Overlaps (same concept, different representation)
| Concept | Datasets | Notes |
|---------|----------|-------|
| Spending/cost | Medicaid (total_paid), Medicare B (Avg_Mdcr_Pymt_Amt * Tot_Srvcs), Inpatient (Avg_Mdcr_Pymt_Amt * Tot_Dschrgs), Part D (Tot_Drug_Cst) | Different payers, different calculation methods. Compare trends, NOT sum across. |
| Beneficiaries | Medicaid (unique_beneficiaries), Medicare B (Tot_Benes), Part D (Tot_Benes) | Different populations. Cannot sum. Report per-dataset. |
| BMI/Obesity | BRFSS (_BMI5CAT, self-reported), NHANES (BMXBMI, measured) | BRFSS overestimates height/underestimates weight. NHANES is measured. |
| Diabetes | BRFSS (DIABETE4, self-reported), NHANES (LBXGH HbA1c + DIQ010 diagnosis) | NHANES can detect undiagnosed. BRFSS is self-reported only. |

### Common Cross-Dataset SQL Patterns

NPI join between Medicare Part B and Part D (aggregate first):
\`\`\`sql
WITH b AS (
  SELECT Rndrng_NPI, SUM(Avg_Mdcr_Pymt_Amt * Tot_Srvcs) AS partb_total
  FROM medicare WHERE data_year = 2023
  GROUP BY Rndrng_NPI
),
d AS (
  SELECT Prscrbr_NPI, SUM(Tot_Drug_Cst) AS partd_total
  FROM medicare_partd WHERE data_year = 2023
  GROUP BY Prscrbr_NPI
)
SELECT b.Rndrng_NPI, b.partb_total, d.partd_total
FROM b JOIN d ON b.Rndrng_NPI = d.Prscrbr_NPI
ORDER BY b.partb_total + d.partd_total DESC LIMIT 20
\`\`\`

State-level: claims spending vs BRFSS prevalence (parallel, narrative join):
-- Query 1: Medicare spending by state
-- Query 2: BRFSS obesity prevalence by state
-- Join in narrative summary, not in SQL (different populations, different weights)`;

// --- Build Combined Schema Prompt ---

export function buildCrossDatasetSchemaPrompt(
  datasetKeys: string[],
): string {
  const sections: string[] = [];

  // Add each dataset's schema
  for (const key of datasetKeys) {
    const config = getDataset(key);
    const schema = config.generateSchemaPrompt();
    sections.push(`## Dataset: ${config.label} (${key})\n\n${schema}`);
  }

  // Add join reference for multi-dataset queries
  if (datasetKeys.length > 1) {
    sections.push(JOIN_REFERENCE);
  }

  return sections.join("\n\n---\n\n");
}

// --- Build Combined Domain Knowledge ---

export function buildCombinedDomainKnowledge(datasetKeys: string[]): string {
  const sections: string[] = [];

  for (const key of datasetKeys) {
    const config = getDataset(key);
    if (config.domainKnowledge) {
      sections.push(config.domainKnowledge);
    }
  }

  return sections.join("\n\n");
}
