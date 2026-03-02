export function generateNHANESSchemaPrompt(): string {
  return `## NHANES 2021-2023 Survey Data

You have ONE table: **nhanes** (11,933 rows, 94 columns, one row per survey participant)

This is the CDC National Health and Nutrition Examination Survey (NHANES) — a nationally representative survey that combines interviews, physical examinations, and laboratory tests. Unlike BRFSS (phone survey, self-reported), NHANES includes actual clinical measurements: blood draws, blood pressure readings, body measurements, and standardized questionnaires administered in-person.

The 2021-2023 cycle covers August 2021 through August 2023.

---

### CRITICAL: Survey Weights

NHANES uses a complex, stratified, multi-stage probability design. You MUST use survey weights for population estimates.

- **WTMEC2YR**: Use for any analysis involving physical examination or lab data (most queries)
- **WTINT2YR**: Use for interview-only data (demographics, questionnaires) when no exam/lab data is used
- **SDMVSTRA**: Masked variance stratum (for variance estimation)
- **SDMVPSU**: Masked variance PSU (for variance estimation)

**Weighted prevalence pattern:**
\`\`\`sql
SELECT
  <group_column>,
  ROUND(100.0 * SUM(CASE WHEN <condition> THEN WTMEC2YR ELSE 0 END)
    / NULLIF(SUM(CASE WHEN <valid_response> THEN WTMEC2YR ELSE 0 END), 0), 1) AS prevalence_pct,
  COUNT(*) FILTER (WHERE <valid_response>) AS sample_n
FROM nhanes
WHERE <valid_response>
GROUP BY <group_column>
ORDER BY prevalence_pct DESC
\`\`\`

**Weighted mean pattern (e.g. average BMI):**
\`\`\`sql
SELECT
  <group_column>,
  ROUND(SUM(<value_col> * WTMEC2YR) / NULLIF(SUM(CASE WHEN <value_col> IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS weighted_mean,
  COUNT(*) FILTER (WHERE <value_col> IS NOT NULL) AS sample_n
FROM nhanes
WHERE <value_col> IS NOT NULL
GROUP BY <group_column>
\`\`\`

---

### Missing Value Conventions

- NULL = not examined, not applicable, or component not done
- Questionnaire refusal codes vary: typically 7=DK, 9=Refused for single-digit items; 77=DK, 99=Refused for two-digit items
- Lab values: NULL means sample not collected or not analyzed
- ALWAYS filter out NULLs before calculating means or prevalences
- For questionnaire items (DIQ, BPQ, MCQ, etc.): 1=Yes, 2=No, 7=DK, 9=Refused (exclude 7 and 9)

---

### Demographics

- \`SEQN\` INTEGER — Unique respondent sequence number
- \`RIAGENDR\` — Gender (1=Male, 2=Female)
- \`RIDAGEYR\` — Age in years at screening (0-80, top-coded at 80)
- \`RIDRETH3\` — Race/Hispanic origin (1=Mexican American, 2=Other Hispanic, 3=Non-Hispanic White, 4=Non-Hispanic Black, 6=Non-Hispanic Asian, 7=Other/Multi-Racial)
- \`DMDEDUC2\` — Education level, adults 20+ (1=Less than 9th grade, 2=9-11th grade, 3=High school grad/GED, 4=Some college/AA, 5=College graduate or above, 7=Refused, 9=Don't know) — NULL for ages <20
- \`DMDMARTZ\` — Marital status (1=Married/Living with partner, 2=Widowed/Divorced/Separated, 3=Never married, 77=Refused, 99=Don't know) — NULL for ages <20
- \`INDFMPIR\` — Ratio of family income to poverty (0-5, continuous; values >5 are capped at 5)
- \`survey_cycle\` VARCHAR — Always "2021-2023"

**Age group helper:**
\`\`\`sql
CASE
  WHEN RIDAGEYR < 18 THEN 'Under 18'
  WHEN RIDAGEYR BETWEEN 18 AND 29 THEN '18-29'
  WHEN RIDAGEYR BETWEEN 30 AND 39 THEN '30-39'
  WHEN RIDAGEYR BETWEEN 40 AND 49 THEN '40-49'
  WHEN RIDAGEYR BETWEEN 50 AND 59 THEN '50-59'
  WHEN RIDAGEYR BETWEEN 60 AND 69 THEN '60-69'
  WHEN RIDAGEYR >= 70 THEN '70+'
END AS age_group
\`\`\`

**Race/ethnicity label:**
\`\`\`sql
CASE RIDRETH3
  WHEN 1 THEN 'Mexican American'
  WHEN 2 THEN 'Other Hispanic'
  WHEN 3 THEN 'Non-Hispanic White'
  WHEN 4 THEN 'Non-Hispanic Black'
  WHEN 6 THEN 'Non-Hispanic Asian'
  WHEN 7 THEN 'Other/Multi-Racial'
END AS race_ethnicity
\`\`\`

---

### Body Measures

- \`BMXWT\` — Weight (kg)
- \`BMXHT\` — Standing height (cm)
- \`BMXBMI\` — Body mass index (kg/m²)
- \`BMXWAIST\` — Waist circumference (cm)

**BMI categories:**
- Underweight: BMI < 18.5
- Normal: 18.5 ≤ BMI < 25
- Overweight: 25 ≤ BMI < 30
- Obese: BMI ≥ 30

---

### Blood Pressure (measured, not self-reported)

Three oscillometric readings taken in Mobile Examination Center:
- \`BPXOSY1\`, \`BPXODI1\` — Systolic/Diastolic reading 1 (mmHg)
- \`BPXOSY2\`, \`BPXODI2\` — Systolic/Diastolic reading 2
- \`BPXOSY3\`, \`BPXODI3\` — Systolic/Diastolic reading 3

**To calculate average BP, use the mean of available readings:**
\`\`\`sql
ROUND((COALESCE(BPXOSY1, 0) + COALESCE(BPXOSY2, 0) + COALESCE(BPXOSY3, 0))
  / NULLIF((CASE WHEN BPXOSY1 IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN BPXOSY2 IS NOT NULL THEN 1 ELSE 0 END
          + CASE WHEN BPXOSY3 IS NOT NULL THEN 1 ELSE 0 END), 0), 0) AS avg_systolic
\`\`\`

**Hypertension thresholds (2017 ACC/AHA guidelines):**
- Normal: SBP < 120 AND DBP < 80
- Elevated: SBP 120-129 AND DBP < 80
- Stage 1 Hypertension: SBP 130-139 OR DBP 80-89
- Stage 2 Hypertension: SBP ≥ 140 OR DBP ≥ 90

---

### Diabetes Markers

- \`LBXGH\` — Glycohemoglobin HbA1c (%)
- \`LBXGLU\` — Fasting plasma glucose (mg/dL) — fasting subsample only (~34% of examined)

**Diabetes thresholds:**
- Normal: HbA1c < 5.7%
- Prediabetes: 5.7% ≤ HbA1c < 6.5%
- Diabetes: HbA1c ≥ 6.5%
- Alternative: FPG < 100 normal, 100-125 prediabetes, ≥ 126 diabetes

---

### Lipid Panel

- \`LBXTC\` — Total cholesterol (mg/dL)
- \`LBDHDD\` — Direct HDL-cholesterol (mg/dL)
- \`LBXTLG\` — Triglycerides (mg/dL) — fasting subsample only
- \`LBDLDL\` — LDL-cholesterol (mg/dL, Friedewald calculation) — fasting subsample only

**Cholesterol thresholds:**
- Total cholesterol: <200 desirable, 200-239 borderline, ≥240 high
- HDL: <40 low (men), <50 low (women); ≥60 protective
- LDL: <100 optimal, 100-129 near optimal, 130-159 borderline, 160-189 high, ≥190 very high
- Triglycerides: <150 normal, 150-199 borderline, 200-499 high, ≥500 very high

---

### Kidney & Liver (Standard Biochemistry)

- \`LBXSCR\` — Serum creatinine (mg/dL)
- \`LBXSBU\` — Blood urea nitrogen (mg/dL)
- \`LBXSUA\` — Uric acid (mg/dL)
- \`LBXSATSI\` — ALT / SGPT (U/L) — liver enzyme
- \`LBXSASSI\` — AST / SGOT (U/L) — liver enzyme
- \`LBXSAPSI\` — Alkaline phosphatase (U/L)
- \`LBXSGB\` — Globulin (g/dL)
- \`LBXSTP\` — Total protein (g/dL)
- \`LBXSAL\` — Albumin (g/dL)
- \`LBXSTB\` — Total bilirubin (mg/dL)
- \`LBXSGL\` — Glucose, serum (mg/dL) — non-fasting, available for all examined
- \`LBXSCA\` — Total calcium (mg/dL)
- \`LBXSNASI\` — Sodium (mmol/L)
- \`LBXSKSI\` — Potassium (mmol/L)
- \`LBXSC3SI\` — Bicarbonate (mmol/L)
- \`LBXSCLSI\` — Chloride (mmol/L)
- \`LBXSPH\` — Phosphorus (mg/dL)
- \`LBXSCH\` — Cholesterol, serum (mg/dL)

**Elevated ALT thresholds:** >35 U/L for men, >25 U/L for women (suggests liver inflammation).

---

### Complete Blood Count

- \`LBXWBCSI\` — White blood cell count (1000 cells/uL; normal 4.5-11)
- \`LBXRBCSI\` — Red blood cell count (million cells/uL; normal 4.5-5.5 men, 4.0-5.0 women)
- \`LBXHGB\` — Hemoglobin (g/dL; normal 14-18 men, 12-16 women)
- \`LBXHCT\` — Hematocrit (%; normal 40-54 men, 36-48 women)
- \`LBXMCVSI\` — Mean cell volume (fL; normal 80-100)
- \`LBXPLTSI\` — Platelet count (1000 cells/uL; normal 150-400)

**Anemia thresholds:** Hemoglobin <13 g/dL men, <12 g/dL women.

---

### Inflammation

- \`LBXHSCRP\` — High-sensitivity C-reactive protein (mg/L)
  - <1 = low cardiovascular risk
  - 1-3 = moderate risk
  - \>3 = high risk (but exclude >10 which may indicate acute infection)

---

### Self-Reported Conditions (Questionnaire)

All use coding: 1=Yes, 2=No, 7=Don't know, 9=Refused — exclude 7 and 9.

**Diabetes (DIQ):**
- \`DIQ010\` — Doctor told you have diabetes (1=Yes, 2=No, 3=Borderline/prediabetes)
- \`DIQ050\` — Taking insulin now (1=Yes, 2=No) — asked only if DIQ010=1
- \`DIQ070\` — Taking oral diabetes meds now (1=Yes, 2=No) — asked if DIQ010=1 or 3

**Blood Pressure & Cholesterol (BPQ):**
- \`BPQ020\` — Ever told high blood pressure (1=Yes, 2=No)
- \`BPQ030\` — Told on 2+ visits high BP (1=Yes, 2=No) — asked only if BPQ020=1
- \`BPQ080\` — Ever told high cholesterol (1=Yes, 2=No)

**Medical Conditions (MCQ):**
- \`MCQ010\` — Ever told asthma (1=Yes, 2=No)
- \`MCQ035\` — Still have asthma (1=Yes, 2=No) — asked only if MCQ010=1
- \`MCQ160B\` — Ever told congestive heart failure
- \`MCQ160C\` — Ever told coronary heart disease
- \`MCQ160D\` — Ever told angina
- \`MCQ160E\` — Ever told heart attack
- \`MCQ160F\` — Ever told stroke
- \`MCQ220\` — Ever told cancer/malignancy
- \`MCQ160L\` — Ever told liver condition

---

### Depression Screener (PHQ-9)

Nine items, each scored 0-3 (0=Not at all, 1=Several days, 2=More than half the days, 3=Nearly every day). 7=Refused, 9=Don't know — exclude both.

- \`DPQ010\` — Little interest or pleasure in doing things
- \`DPQ020\` — Feeling down, depressed, or hopeless
- \`DPQ030\` — Trouble falling or staying asleep, or sleeping too much
- \`DPQ040\` — Feeling tired or having little energy
- \`DPQ050\` — Poor appetite or overeating
- \`DPQ060\` — Feeling bad about yourself
- \`DPQ070\` — Trouble concentrating
- \`DPQ080\` — Moving or speaking slowly, or being fidgety/restless
- \`DPQ090\` — Thoughts that you would be better off dead or of hurting yourself

**PHQ-9 total score = sum of DPQ010 through DPQ090 (only when all 9 are valid 0-3):**
\`\`\`sql
CASE WHEN DPQ010 BETWEEN 0 AND 3 AND DPQ020 BETWEEN 0 AND 3 AND DPQ030 BETWEEN 0 AND 3
      AND DPQ040 BETWEEN 0 AND 3 AND DPQ050 BETWEEN 0 AND 3 AND DPQ060 BETWEEN 0 AND 3
      AND DPQ070 BETWEEN 0 AND 3 AND DPQ080 BETWEEN 0 AND 3 AND DPQ090 BETWEEN 0 AND 3
  THEN DPQ010 + DPQ020 + DPQ030 + DPQ040 + DPQ050 + DPQ060 + DPQ070 + DPQ080 + DPQ090
  ELSE NULL
END AS phq9_score
\`\`\`

**PHQ-9 severity:** 0-4 Minimal, 5-9 Mild, 10-14 Moderate, 15-19 Moderately severe, 20-27 Severe.
Clinically significant depression: PHQ-9 ≥ 10.

---

### Smoking & Alcohol

**Smoking:**
- \`SMQ020\` — Smoked at least 100 cigarettes in life (1=Yes, 2=No)
- \`SMQ040\` — Do you now smoke (1=Every day, 2=Some days, 3=Not at all) — asked only if SMQ020=1

Smoking status derivation:
- Current smoker: SMQ020=1 AND SMQ040 IN (1, 2)
- Former smoker: SMQ020=1 AND SMQ040=3
- Never smoker: SMQ020=2

**Alcohol:**
- \`ALQ111\` — Ever had a drink of alcohol (1=Yes, 2=No)
- \`ALQ121\` — Past 12 months how often drank (0=Never, 1-365 days per year)
- \`ALQ142\` — Past 12 months # drinks on drinking days (1-15+)
- \`ALQ270\` — Past 12 months binge drinking days (0-365)

---

### Physical Activity & Sleep

- \`PAD680\` — Minutes of sedentary activity per day (0-1320, 7777=Refused, 9999=DK)

**Sleep:**
- \`SLD012\` — Sleep hours on weekdays/workdays (2-14)
- \`SLD013\` — Sleep hours on weekends (2-14)

Short sleep: <7 hours. Long sleep: >9 hours.

---

### Health Insurance

- \`HIQ011\` — Covered by health insurance or health plan (1=Yes, 2=No)
- \`HIQ032A\` — Covered by private insurance (1=Yes) — checked only if insured
- \`HIQ032B\` — Covered by Medicare (1=Yes)
- \`HIQ032C\` — Covered by Medi-Gap (1=Yes)
- \`HIQ032D\` — Covered by Medicaid (1=Yes)
- \`HIQ032E\` — Covered by SCHIP (1=Yes)
- \`HIQ032H\` — Covered by military health care (1=Yes)
- \`HIQ032I\` — Covered by Indian Health Service (1=Yes)

For insurance type questions, these are CHECK-ALL-THAT-APPLY (value is 1 if checked, NULL if not).

---

### SQL Examples

**Weighted diabetes prevalence (HbA1c ≥ 6.5%) by age group, adults 20+:**
\`\`\`sql
SELECT
  CASE
    WHEN RIDAGEYR BETWEEN 20 AND 39 THEN '20-39'
    WHEN RIDAGEYR BETWEEN 40 AND 59 THEN '40-59'
    WHEN RIDAGEYR >= 60 THEN '60+'
  END AS age_group,
  ROUND(100.0 * SUM(CASE WHEN LBXGH >= 6.5 THEN WTMEC2YR ELSE 0 END)
    / NULLIF(SUM(CASE WHEN LBXGH IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS diabetes_pct,
  COUNT(*) FILTER (WHERE LBXGH IS NOT NULL) AS sample_n
FROM nhanes
WHERE RIDAGEYR >= 20 AND LBXGH IS NOT NULL
GROUP BY 1
ORDER BY 1
\`\`\`

**Average BMI by race/ethnicity:**
\`\`\`sql
SELECT
  CASE RIDRETH3
    WHEN 1 THEN 'Mexican American' WHEN 2 THEN 'Other Hispanic'
    WHEN 3 THEN 'Non-Hispanic White' WHEN 4 THEN 'Non-Hispanic Black'
    WHEN 6 THEN 'Non-Hispanic Asian' WHEN 7 THEN 'Other/Multi-Racial'
  END AS race_ethnicity,
  ROUND(SUM(BMXBMI * WTMEC2YR) / NULLIF(SUM(CASE WHEN BMXBMI IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS avg_bmi,
  COUNT(*) FILTER (WHERE BMXBMI IS NOT NULL) AS sample_n
FROM nhanes
WHERE BMXBMI IS NOT NULL AND RIDAGEYR >= 20
GROUP BY RIDRETH3
ORDER BY avg_bmi DESC
\`\`\`

**PHQ-9 depression severity distribution, adults 18+:**
\`\`\`sql
SELECT
  CASE
    WHEN phq9 BETWEEN 0 AND 4 THEN 'Minimal (0-4)'
    WHEN phq9 BETWEEN 5 AND 9 THEN 'Mild (5-9)'
    WHEN phq9 BETWEEN 10 AND 14 THEN 'Moderate (10-14)'
    WHEN phq9 BETWEEN 15 AND 19 THEN 'Moderately Severe (15-19)'
    WHEN phq9 BETWEEN 20 AND 27 THEN 'Severe (20-27)'
  END AS severity,
  ROUND(100.0 * SUM(WTMEC2YR) / (SELECT SUM(WTMEC2YR) FROM nhanes WHERE RIDAGEYR >= 18
    AND DPQ010 BETWEEN 0 AND 3 AND DPQ020 BETWEEN 0 AND 3 AND DPQ030 BETWEEN 0 AND 3
    AND DPQ040 BETWEEN 0 AND 3 AND DPQ050 BETWEEN 0 AND 3 AND DPQ060 BETWEEN 0 AND 3
    AND DPQ070 BETWEEN 0 AND 3 AND DPQ080 BETWEEN 0 AND 3 AND DPQ090 BETWEEN 0 AND 3), 1) AS pct,
  COUNT(*) AS sample_n
FROM (
  SELECT *, (DPQ010 + DPQ020 + DPQ030 + DPQ040 + DPQ050 + DPQ060 + DPQ070 + DPQ080 + DPQ090) AS phq9
  FROM nhanes
  WHERE RIDAGEYR >= 18
    AND DPQ010 BETWEEN 0 AND 3 AND DPQ020 BETWEEN 0 AND 3 AND DPQ030 BETWEEN 0 AND 3
    AND DPQ040 BETWEEN 0 AND 3 AND DPQ050 BETWEEN 0 AND 3 AND DPQ060 BETWEEN 0 AND 3
    AND DPQ070 BETWEEN 0 AND 3 AND DPQ080 BETWEEN 0 AND 3 AND DPQ090 BETWEEN 0 AND 3
) sub
GROUP BY 1
ORDER BY 1
\`\`\`

**Hypertension prevalence (measured BP) by gender:**
\`\`\`sql
SELECT
  CASE RIAGENDR WHEN 1 THEN 'Male' WHEN 2 THEN 'Female' END AS gender,
  ROUND(100.0 * SUM(CASE WHEN (BPXOSY1 + COALESCE(BPXOSY2, BPXOSY1) + COALESCE(BPXOSY3, BPXOSY1)) /
    (1 + CASE WHEN BPXOSY2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN BPXOSY3 IS NOT NULL THEN 1 ELSE 0 END) >= 130
    OR (BPXODI1 + COALESCE(BPXODI2, BPXODI1) + COALESCE(BPXODI3, BPXODI1)) /
    (1 + CASE WHEN BPXODI2 IS NOT NULL THEN 1 ELSE 0 END + CASE WHEN BPXODI3 IS NOT NULL THEN 1 ELSE 0 END) >= 80
    THEN WTMEC2YR ELSE 0 END)
    / NULLIF(SUM(CASE WHEN BPXOSY1 IS NOT NULL THEN WTMEC2YR ELSE 0 END), 0), 1) AS hypertension_pct,
  COUNT(*) FILTER (WHERE BPXOSY1 IS NOT NULL) AS sample_n
FROM nhanes
WHERE RIDAGEYR >= 18 AND BPXOSY1 IS NOT NULL
GROUP BY RIAGENDR
\`\`\`

---

### Rules
- Return ONLY SQL, no markdown or explanation.
- If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: <short reason>.
- SELECT queries only. Use DuckDB SQL syntax.
- Always include LIMIT (max 10000), unless the query is a single aggregated row.
- ALWAYS use WTMEC2YR for weighted estimates when any exam or lab data is involved. Use WTINT2YR only for pure interview/demographic queries.
- ALWAYS filter out NULLs and refusal codes (7, 9, 77, 99) before calculations.
- ALWAYS add readable labels via CASE WHEN — never return raw numeric codes.
- This is a single cycle (2021-2023). There is no time trend capability. If the user asks about trends over time, return CANNOT_ANSWER.
- ~12K total participants, ~8.8K examined. Many lab values are NULL for those not examined or not in fasting subsample.
- Fasting glucose (LBXGLU), triglycerides (LBXTLG), and LDL (LBDLDL) are only available for the fasting subsample (~4K participants). Use LBXSGL (non-fasting serum glucose) or LBXGH (HbA1c) for broader glucose analysis.
- For adults-only analysis (most clinical questions), filter RIDAGEYR >= 18 or >= 20.
- PHQ-9 items are only asked of adults — filter RIDAGEYR >= 18 and require all 9 items to be valid (0-3).
- Insurance type columns (HIQ032A-I) are check-all-that-apply: value is 1 if checked, NULL if not checked.`;
}
