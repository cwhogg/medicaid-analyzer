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
  dataset: "brfss" | "nhanes";
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
      "What percentage of adults have high total cholesterol (240 mg/dL or higher)?",
    expected: [{ column: "high_chol_pct", value: 11.3, tolerance: 2.0 }],
  },

  {
    id: "nhanes-hypertension-measured",
    dataset: "nhanes",
    description:
      "Hypertension prevalence based on measured BP (SBP >= 130 or DBP >= 80)",
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
      "What is the prevalence of hypertension among adults based on measured blood pressure?",
    expected: [
      { column: "hypertension_pct", value: 47.7, tolerance: 5.0 },
    ],
  },
];
