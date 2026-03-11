/**
 * Ground Truth Test Cases for Dataset Validation
 *
 * Each test case references a published statistic from CDC/NCHS and includes:
 * - Gold SQL that should reproduce the value from our data
 * - A natural language question for NL-to-SQL evaluation
 * - Expected value with tolerance
 */

export interface ExpectedResult {
  /** Which result column to check */
  column: string;
  /** Expected numeric value */
  value: number;
  /** Acceptable deviation (e.g., 1.0 means ±1.0 percentage points) */
  tolerance: number;
  /** Optional row filter — match the row where these column values match */
  filter?: Record<string, string>;
}

export interface TestCase {
  id: string;
  dataset: "brfss" | "nhanes" | "medicare-inpatient" | "medicare-partd";
  description: string;
  source: string;
  sql: string;
  question: string;
  expected: ExpectedResult[];
}

export const TEST_CASES: TestCase[] = [
  // ═══════════════════════════════════════════
  // BRFSS — CDC Published Prevalence Data
  // ═══════════════════════════════════════════

  {
    id: "brfss-obesity-national-2017",
    dataset: "brfss",
    description: "National adult obesity prevalence 2017",
    source:
      "CDC Adult Obesity Prevalence Maps — https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2017
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the national adult obesity prevalence in 2017?",
    expected: [{ column: "obesity_pct", value: 30.1, tolerance: 1.0 }],
  },

  {
    id: "brfss-obesity-national-2018",
    dataset: "brfss",
    description: "National adult obesity prevalence 2018",
    source:
      "CDC Adult Obesity Prevalence Maps — https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2018
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the national adult obesity prevalence in 2018?",
    expected: [{ column: "obesity_pct", value: 30.9, tolerance: 1.0 }],
  },

  {
    id: "brfss-obesity-wv-2018",
    dataset: "brfss",
    description: "West Virginia adult obesity prevalence 2018",
    source:
      "CDC State-Level Obesity Data — https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2018
        AND _STATE = 54
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the adult obesity rate in West Virginia in 2018?",
    expected: [{ column: "obesity_pct", value: 39.5, tolerance: 2.0 }],
  },

  {
    id: "brfss-obesity-co-2018",
    dataset: "brfss",
    description: "Colorado adult obesity prevalence 2018",
    source:
      "CDC State-Level Obesity Data — https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2018
        AND _STATE = 8
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the adult obesity rate in Colorado in 2018?",
    expected: [{ column: "obesity_pct", value: 22.9, tolerance: 2.0 }],
  },

  {
    id: "brfss-smoking-national-2018",
    dataset: "brfss",
    description: "National current smoking prevalence 2018",
    source:
      "CDC Tobacco Data — https://www.cdc.gov/tobacco/about-data-statistics/index.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _SMOKER3 IN (1, 2) THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _SMOKER3 BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS smoking_pct
      FROM brfss
      WHERE survey_year = 2018
        AND _SMOKER3 BETWEEN 1 AND 4
    `,
    question:
      "What was the national adult current smoking prevalence in 2018?",
    expected: [{ column: "smoking_pct", value: 15.5, tolerance: 1.5 }],
  },

  {
    id: "brfss-obesity-national-2020",
    dataset: "brfss",
    description: "National adult obesity prevalence 2020",
    source:
      "CDC Adult Obesity Prevalence Maps — https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2020
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the national adult obesity prevalence in 2020?",
    expected: [{ column: "obesity_pct", value: 31.9, tolerance: 1.0 }],
  },

  {
    id: "brfss-diabetes-national-2018",
    dataset: "brfss",
    description: "National diagnosed diabetes prevalence 2018",
    source:
      "CDC Diabetes Surveillance — https://www.cdc.gov/diabetes/php/data-research/index.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN DIABETE4 = 1 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN DIABETE4 IN (1, 2, 3, 4) THEN _LLCPWT ELSE 0 END), 0), 1) AS diabetes_pct
      FROM brfss
      WHERE survey_year = 2018
        AND DIABETE4 IN (1, 2, 3, 4)
    `,
    question:
      "What was the national adult diagnosed diabetes prevalence in 2018?",
    expected: [{ column: "diabetes_pct", value: 10.9, tolerance: 1.5 }],
  },

  // ═══════════════════════════════════════════
  // BRFSS — Additional Condition Prevalences
  // ═══════════════════════════════════════════

  {
    id: "brfss-current-asthma-2018",
    dataset: "brfss",
    description: "National current asthma prevalence 2018",
    source:
      "CDC BRFSS Asthma Data Table C1 — https://www.cdc.gov/asthma/brfss/default.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN ASTHMA3 = 1 AND ASTHNOW = 1 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN ASTHMA3 IN (1, 2) THEN _LLCPWT ELSE 0 END), 0), 1) AS current_asthma_pct
      FROM brfss
      WHERE survey_year = 2018
        AND ASTHMA3 IN (1, 2)
    `,
    question:
      "What was the national current asthma prevalence among adults in 2018?",
    expected: [{ column: "current_asthma_pct", value: 9.2, tolerance: 1.0 }],
  },

  {
    id: "brfss-physical-inactivity-2018",
    dataset: "brfss",
    description: "National physical inactivity prevalence 2018",
    source:
      "CDC Preventing Chronic Disease — https://www.cdc.gov/pcd/issues/2020/20_0106.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _TOTINDA = 2 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _TOTINDA IN (1, 2) THEN _LLCPWT ELSE 0 END), 0), 1) AS inactivity_pct
      FROM brfss
      WHERE survey_year = 2018
        AND _TOTINDA IN (1, 2)
    `,
    question:
      "What percentage of adults reported no leisure-time physical activity in 2018?",
    expected: [{ column: "inactivity_pct", value: 24.5, tolerance: 1.5 }],
  },

  {
    id: "brfss-obesity-national-2023",
    dataset: "brfss",
    description: "National adult obesity prevalence 2023",
    source:
      "CDC Newsroom — https://www.cdc.gov/media/releases/2024/p0912-adult-obesity.html",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
      FROM brfss
      WHERE survey_year = 2023
        AND _BMI5CAT BETWEEN 1 AND 4
    `,
    question:
      "What was the national adult obesity prevalence in 2023?",
    expected: [{ column: "obesity_pct", value: 34.3, tolerance: 2.0 }],
  },

  {
    id: "brfss-depression-2019",
    dataset: "brfss",
    description: "National depressive disorder prevalence 2019",
    source:
      "PLOS ONE / Ettman et al. — https://doi.org/10.1371/journal.pone.0277966",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN ADDEPEV3 = 1 THEN _LLCPWT ELSE 0 END)
          / NULLIF(SUM(CASE WHEN ADDEPEV3 IN (1, 2) THEN _LLCPWT ELSE 0 END), 0), 1) AS depression_pct
      FROM brfss
      WHERE survey_year = 2019
        AND ADDEPEV3 IN (1, 2)
    `,
    question:
      "What percentage of adults reported ever being told they had a depressive disorder in 2019?",
    expected: [{ column: "depression_pct", value: 19.9, tolerance: 2.0 }],
  },

  // ═══════════════════════════════════════════
  // NHANES — NCHS Data Briefs (2021-2023 cycle)
  // ═══════════════════════════════════════════

  {
    id: "nhanes-obesity-overall",
    dataset: "nhanes",
    description: "Overall adult obesity prevalence (measured BMI >= 30)",
    source:
      "NCHS Data Brief No. 508 — https://www.cdc.gov/nchs/products/databriefs/db508.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN BMXBMI >= 30 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN BMXBMI IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS obesity_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND BMXBMI IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What is the overall adult obesity prevalence based on measured BMI?",
    expected: [{ column: "obesity_pct", value: 40.3, tolerance: 2.0 }],
  },

  {
    id: "nhanes-obesity-male",
    dataset: "nhanes",
    description: "Male adult obesity prevalence (measured BMI >= 30)",
    source:
      "NCHS Data Brief No. 508 — https://www.cdc.gov/nchs/products/databriefs/db508.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN BMXBMI >= 30 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN BMXBMI IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS obesity_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND RIAGENDR = 1
        AND BMXBMI IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What is the obesity prevalence among adult men based on measured BMI?",
    expected: [{ column: "obesity_pct", value: 39.2, tolerance: 2.0 }],
  },

  {
    id: "nhanes-obesity-female",
    dataset: "nhanes",
    description: "Female adult obesity prevalence (measured BMI >= 30)",
    source:
      "NCHS Data Brief No. 508 — https://www.cdc.gov/nchs/products/databriefs/db508.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN BMXBMI >= 30 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN BMXBMI IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS obesity_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND RIAGENDR = 2
        AND BMXBMI IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What is the obesity prevalence among adult women based on measured BMI?",
    expected: [{ column: "obesity_pct", value: 41.3, tolerance: 2.0 }],
  },

  {
    id: "nhanes-diabetes-total",
    dataset: "nhanes",
    description:
      "Total diabetes prevalence (diagnosed + undiagnosed via HbA1c >= 6.5%)",
    source:
      "NCHS Data Brief No. 516 — https://www.cdc.gov/nchs/products/databriefs/db516.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN DIQ010 = 1 OR LBXGH >= 6.5 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN (DIQ010 IN (1, 2, 3) OR LBXGH IS NOT NULL) THEN WTMEC2YR ELSE 0 END), 0), 1) AS diabetes_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND WTMEC2YR > 0
        AND (DIQ010 IN (1, 2, 3) OR LBXGH IS NOT NULL)
    `,
    question:
      "What is the total diabetes prevalence among adults, including undiagnosed cases?",
    expected: [{ column: "diabetes_pct", value: 15.8, tolerance: 3.0 }],
  },

  {
    id: "nhanes-high-cholesterol",
    dataset: "nhanes",
    description: "High total cholesterol prevalence (>= 240 mg/dL)",
    source:
      "NCHS Data Brief No. 515 — https://www.cdc.gov/nchs/products/databriefs/db515.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN LBXTC >= 240 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN LBXTC IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS high_chol_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND LBXTC IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What percentage of adults have measured total cholesterol of 240 mg/dL or higher based on lab values?",
    expected: [{ column: "high_chol_pct", value: 11.3, tolerance: 2.0 }],
  },

  {
    id: "nhanes-hypertension",
    dataset: "nhanes",
    description:
      "Hypertension prevalence (measured high BP or self-reported diagnosis)",
    source:
      "NCHS Data Brief No. 511 — https://www.cdc.gov/nchs/products/databriefs/db511.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE
          WHEN (BPXOSY1 + COALESCE(BPXOSY2, BPXOSY1) + COALESCE(BPXOSY3, BPXOSY1))
            / (1 + CASE WHEN BPXOSY2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN BPXOSY3 IS NOT NULL THEN 1 ELSE 0 END) >= 130
          OR (BPXODI1 + COALESCE(BPXODI2, BPXODI1) + COALESCE(BPXODI3, BPXODI1))
            / (1 + CASE WHEN BPXODI2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN BPXODI3 IS NOT NULL THEN 1 ELSE 0 END) >= 80
          OR BPQ020 = 1
          THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN BPXOSY1 IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS hypertension_pct
      FROM nhanes
      WHERE RIDAGEYR >= 18
        AND BPXOSY1 IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What is the prevalence of hypertension among adults?",
    expected: [
      { column: "hypertension_pct", value: 47.7, tolerance: 5.0 },
    ],
  },

  {
    id: "nhanes-severe-obesity",
    dataset: "nhanes",
    description: "Severe obesity prevalence (measured BMI >= 40)",
    source:
      "NCHS Data Brief No. 508 — https://www.cdc.gov/nchs/products/databriefs/db508.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE WHEN BMXBMI >= 40 THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(CASE WHEN BMXBMI IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS severe_obesity_pct
      FROM nhanes
      WHERE RIDAGEYR >= 20
        AND BMXBMI IS NOT NULL
        AND WTMEC2YR > 0
    `,
    question:
      "What is the prevalence of severe obesity (BMI 40 or higher) among adults?",
    expected: [{ column: "severe_obesity_pct", value: 9.4, tolerance: 1.5 }],
  },

  {
    id: "nhanes-depression-phq9",
    dataset: "nhanes",
    description: "Depression prevalence (PHQ-9 score >= 10) among ages 12+",
    source:
      "NCHS Data Brief No. 527 — https://www.cdc.gov/nchs/products/databriefs/db527.htm",
    sql: `
      SELECT
        ROUND(100.0 * SUM(CASE
          WHEN (DPQ010 + DPQ020 + DPQ030 + DPQ040 + DPQ050 + DPQ060 + DPQ070 + DPQ080 + DPQ090) >= 10
          THEN WTMEC2YR ELSE 0 END)
          / NULLIF(SUM(WTMEC2YR), 0), 1) AS depression_pct
      FROM nhanes
      WHERE RIDAGEYR >= 12
        AND DPQ010 BETWEEN 0 AND 3 AND DPQ020 BETWEEN 0 AND 3 AND DPQ030 BETWEEN 0 AND 3
        AND DPQ040 BETWEEN 0 AND 3 AND DPQ050 BETWEEN 0 AND 3 AND DPQ060 BETWEEN 0 AND 3
        AND DPQ070 BETWEEN 0 AND 3 AND DPQ080 BETWEEN 0 AND 3 AND DPQ090 BETWEEN 0 AND 3
        AND WTMEC2YR > 0
    `,
    question:
      "What percentage of people aged 12 and older have symptoms of depression based on PHQ-9 score of 10 or higher?",
    expected: [{ column: "depression_pct", value: 13.1, tolerance: 2.0 }],
  },

  // ═══════════════════════════════════════════
  // Medicare Inpatient (Part A) — CMS IPPS PUF
  // ═══════════════════════════════════════════

  {
    id: "inpatient-hospital-count-2023",
    dataset: "medicare-inpatient",
    description: "Number of IPPS hospitals in 2023",
    source:
      "CMS Medicare Inpatient Hospitals PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service",
    sql: `
      SELECT COUNT(DISTINCT Rndrng_Prvdr_CCN) AS hospital_count
      FROM medicare_inpatient
      WHERE data_year = 2023
    `,
    question:
      "How many hospitals are in the Medicare inpatient dataset for 2023?",
    expected: [{ column: "hospital_count", value: 2941, tolerance: 10.0 }],
  },

  {
    id: "inpatient-drg-count-2023",
    dataset: "medicare-inpatient",
    description: "Number of distinct DRG codes in 2023",
    source:
      "CMS FY 2023 IPPS Final Rule — https://www.cms.gov/newsroom/fact-sheets/fy-2023-hospital-inpatient-prospective-payment-system-ipps-and-long-term-care-hospital-prospective",
    sql: `
      SELECT COUNT(DISTINCT DRG_Cd) AS drg_count
      FROM medicare_inpatient
      WHERE data_year = 2023
    `,
    question:
      "How many distinct DRG codes are in the 2023 Medicare inpatient data?",
    expected: [{ column: "drg_count", value: 534, tolerance: 15.0 }],
  },

  {
    id: "inpatient-top-drg-septicemia-2023",
    dataset: "medicare-inpatient",
    description:
      "Top DRG by discharges is Septicemia (871) in 2023",
    source:
      "CMS IPPS PUF / Definitive Healthcare — https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service",
    sql: `
      SELECT DRG_Cd, DRG_Desc, SUM(Tot_Dschrgs) AS total_discharges
      FROM medicare_inpatient
      WHERE data_year = 2023
      GROUP BY DRG_Cd, DRG_Desc
      ORDER BY total_discharges DESC
      LIMIT 1
    `,
    question:
      "What is the #1 DRG by total discharges in 2023 Medicare inpatient data?",
    expected: [{ column: "total_discharges", value: 561177, tolerance: 2.0 }],
  },

  {
    id: "inpatient-second-drg-heartfailure-2023",
    dataset: "medicare-inpatient",
    description:
      "#2 DRG by discharges is Heart Failure (291) in 2023",
    source:
      "CMS IPPS PUF / Definitive Healthcare — https://data.cms.gov/provider-summary-by-type-of-service/medicare-inpatient-hospitals/medicare-inpatient-hospitals-by-provider-and-service",
    sql: `
      SELECT DRG_Cd, DRG_Desc, SUM(Tot_Dschrgs) AS total_discharges
      FROM medicare_inpatient
      WHERE data_year = 2023
      GROUP BY DRG_Cd, DRG_Desc
      ORDER BY total_discharges DESC
      LIMIT 1 OFFSET 1
    `,
    question:
      "What DRG has the second most total discharges in 2023 Medicare inpatient data?",
    expected: [{ column: "total_discharges", value: 319367, tolerance: 2.0 }],
  },

  // ═══════════════════════════════════════════
  // Medicare Part D — CMS Part D Prescribers PUF
  // ═══════════════════════════════════════════

  {
    id: "partd-prescribers-2023",
    dataset: "medicare-partd",
    description: "Unique Part D prescribers in 2023",
    source:
      "CMS Part D Prescribers PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    sql: `
      SELECT COUNT(DISTINCT Prscrbr_NPI) AS prescriber_count
      FROM medicare_partd
      WHERE data_year = 2023
    `,
    question:
      "How many unique prescribers are in the 2023 Part D data?",
    expected: [
      { column: "prescriber_count", value: 1104162, tolerance: 1.0 },
    ],
  },

  {
    id: "partd-total-claims-2023",
    dataset: "medicare-partd",
    description: "Total Part D claims in 2023",
    source:
      "CMS Part D Prescribers PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    sql: `
      SELECT SUM(Tot_Clms) AS total_claims
      FROM medicare_partd
      WHERE data_year = 2023
    `,
    question:
      "What is the total number of Part D claims in 2023?",
    expected: [
      { column: "total_claims", value: 1393568104, tolerance: 1.0 },
    ],
  },

  {
    id: "partd-drug-cost-2023",
    dataset: "medicare-partd",
    description: "Total Part D drug cost in 2023",
    source:
      "CMS Part D Prescribers PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    sql: `
      SELECT ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost
      FROM medicare_partd
      WHERE data_year = 2023
    `,
    question:
      "What is the total drug cost in the 2023 Part D data?",
    expected: [
      { column: "total_drug_cost", value: 212689454816, tolerance: 1.0 },
    ],
  },

  {
    id: "partd-prescribers-2019",
    dataset: "medicare-partd",
    description: "Unique Part D prescribers in 2019",
    source:
      "CMS Part D Prescribers PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    sql: `
      SELECT COUNT(DISTINCT Prscrbr_NPI) AS prescriber_count
      FROM medicare_partd
      WHERE data_year = 2019
    `,
    question:
      "How many unique prescribers were in the 2019 Part D data?",
    expected: [
      { column: "prescriber_count", value: 985533, tolerance: 1.0 },
    ],
  },

  {
    id: "partd-drug-cost-2019",
    dataset: "medicare-partd",
    description: "Total Part D drug cost in 2019",
    source:
      "CMS Part D Prescribers PUF — https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
    sql: `
      SELECT ROUND(SUM(Tot_Drug_Cst), 0) AS total_drug_cost
      FROM medicare_partd
      WHERE data_year = 2019
    `,
    question:
      "What is the total drug cost in the 2019 Part D data?",
    expected: [
      { column: "total_drug_cost", value: 137025088397, tolerance: 1.0 },
    ],
  },
];
