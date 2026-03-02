export function generateBRFSSSchemaPrompt(): string {
  return `## BRFSS 2014-2020, 2023 Survey Data

You have ONE table: **brfss** (~3.5M rows, 72 columns, one row per respondent)

This is the CDC Behavioral Risk Factor Surveillance System — the largest continuously conducted telephone health survey in the world. Data spans 8 survey years: 2014, 2015, 2016, 2017, 2018, 2019, 2020, and 2023 (2021-2022 are excluded due to major variable renames).

---

### CRITICAL: Survey Weights

ALWAYS use \`_LLCPWT\` (landline/cell combined weight) for population estimates. Raw counts are NOT representative.

Weighted prevalence pattern:
\`\`\`sql
SELECT
  <group_column>,
  ROUND(100.0 * SUM(CASE WHEN <condition_yes> THEN _LLCPWT ELSE 0 END)
    / NULLIF(SUM(CASE WHEN <valid_response> THEN _LLCPWT ELSE 0 END), 0), 1) AS prevalence_pct,
  COUNT(*) FILTER (WHERE <valid_response>) AS sample_n
FROM brfss
WHERE <valid_response>
GROUP BY <group_column>
ORDER BY prevalence_pct DESC
\`\`\`

Weighted mean pattern (e.g. average days of poor health):
\`\`\`sql
SELECT
  <group_column>,
  ROUND(SUM(<value_col> * _LLCPWT) / NULLIF(SUM(_LLCPWT), 0), 1) AS weighted_mean
FROM brfss
WHERE <value_col> BETWEEN 0 AND 30  -- exclude DK/Refused
GROUP BY <group_column>
\`\`\`

---

### CRITICAL: Multi-Year Trend Queries

Use the \`survey_year\` column to analyze trends over time. Always GROUP BY survey_year for trend analysis.

**Trend query pattern:**
\`\`\`sql
SELECT
  survey_year,
  ROUND(100.0 * SUM(CASE WHEN <condition_yes> THEN _LLCPWT ELSE 0 END)
    / NULLIF(SUM(CASE WHEN <valid_response> THEN _LLCPWT ELSE 0 END), 0), 1) AS prevalence_pct,
  COUNT(*) FILTER (WHERE <valid_response>) AS sample_n
FROM brfss
WHERE <valid_response>
GROUP BY survey_year
ORDER BY survey_year
\`\`\`

**IMPORTANT**: There is a gap — 2021 and 2022 are NOT in the data. Do not interpolate or assume values for those years. When presenting trends, note this gap.

When the user asks about a specific year, filter with: \`WHERE survey_year = <year>\`
When the user asks about a range, use: \`WHERE survey_year BETWEEN <start> AND <end>\`

---

### Coding Conventions

ALL values are numeric codes. NEVER assume text values exist in the data.

**Standard refusal/missing codes (EXCLUDE from calculations):**
- 7 or 77 = Don't know / Not sure
- 9 or 99 = Refused
- BLANK / NULL = Not asked / Missing

For yes/no variables: 1 = Yes, 2 = No
For scales (e.g. GENHLTH): lower numbers = better (1=Excellent, 5=Poor)
Days variables (PHYSHLTH, MENTHLTH): 1-30 = number of days, 88 = None, 77 = DK, 99 = Refused

**ALWAYS add readable labels in output using CASE WHEN.** Never return raw codes without labels.

---

### Core Columns (organized by topic)

**Survey Year:**
- \`survey_year\` (integer: 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2023)

**Demographics:**
- \`_STATE\` (FIPS code — see state lookup below)
- \`SEXVAR\` (1=Male, 2=Female)
- \`_SEX\` (calculated sex, same coding — available 2019+ only)
- \`_AGEG5YR\` (5-year age groups: 1=18-24, 2=25-29, 3=30-34, 4=35-39, 5=40-44, 6=45-49, 7=50-54, 8=55-59, 9=60-64, 10=65-69, 11=70-74, 12=75-79, 13=80+, 14=DK/Refused)
- \`_AGE80\` (imputed age, top-coded at 80)
- \`_AGE_G\` (6 age groups: 1=18-24, 2=25-34, 3=35-44, 4=45-54, 5=55-64, 6=65+)
- \`_IMPRACE\` (imputed race: 1=White, 2=Black, 3=Asian, 4=AI/AN, 5=Hispanic, 6=Other — available 2014, 2017+ only)
- \`_RACEGR3\` (race groups: 1=White, 2=Black, 3=Other, 4=Multiracial, 5=Hispanic, 9=DK)
- \`EDUCA\` (education: 1=Never attended, 2=Grades 1-8, 3=Grades 9-11, 4=HS grad, 5=Some college, 6=College grad, 9=Refused)
- \`_EDUCAG\` (education grouped: 1=Did not graduate HS, 2=Graduated HS, 3=Attended college, 4=Graduated college, 9=DK)
- \`MARITAL\` (1=Married, 2=Divorced, 3=Widowed, 4=Separated, 5=Never married, 6=Unmarried couple, 9=Refused)
- \`EMPLOY1\` (1=Employed, 2=Self-employed, 3=Unemployed 1yr+, 4=Unemployed <1yr, 5=Homemaker, 6=Student, 7=Retired, 8=Unable to work, 9=Refused)
- \`VETERAN3\` (1=Yes, 2=No, 7=DK, 9=Refused)
- \`CHILDREN\` (number of children in household, 88=None, 99=Refused)

**Income (IMPORTANT — coding changed between eras):**
- \`INCOME2\` — available for 2014-2020 ONLY (8 categories: 1=<$10K, 2=$10-15K, 3=$15-20K, 4=$20-25K, 5=$25-35K, 6=$35-50K, 7=$50-75K, 8=$75K+, 77=DK, 99=Refused)
- \`INCOME3\` — available for 2023 ONLY (11 categories: 1=<$10K, 2=$10-15K, 3=$15-20K, 4=$20-25K, 5=$25-35K, 6=$35-50K, 7=$50-75K, 8=$75-100K, 9=$100-150K, 10=$150-200K, 11=$200K+, 77=DK, 99=Refused)
- \`_INCOMG\` — available for 2014-2020 ONLY (5 groups: 1=<$15K, 2=$15-25K, 3=$25-35K, 4=$35-50K, 5=$50K+, 9=DK)
- \`_INCOMG1\` — available for 2023 ONLY (7 groups: 1=<$15K, 2=$15-25K, 3=$25-35K, 4=$35-50K, 5=$50-100K, 6=$100-200K, 7=$200K+, 9=DK)
- For cross-year income analysis, use INCOME2 for 2014-2020 and INCOME3 for 2023 separately, or create comparable bins manually. DO NOT mix these columns in the same query without careful binning.

**General Health:**
- \`GENHLTH\` (1=Excellent, 2=Very good, 3=Good, 4=Fair, 5=Poor, 7=DK, 9=Refused)
- \`PHYSHLTH\` (days of poor physical health in past 30, 88=None, 77=DK, 99=Refused)
- \`MENTHLTH\` (days of poor mental health in past 30, 88=None, 77=DK, 99=Refused)
- \`POORHLTH\` (days poor health prevented activities, 88=None, 77=DK, 99=Refused)
- \`_RFHLTH\` (calculated: 1=Good or better health, 2=Fair or poor, 9=DK)
- \`_PHYS14D\` (calculated: 1=0-13 days poor physical health, 2=14+ days, 9=DK — available 2015+ only)
- \`_MENT14D\` (calculated: 1=0-13 days poor mental health, 2=14+ days, 9=DK — available 2015+ only)

**Chronic Conditions (all: 1=Yes, 2=No, 7=DK, 9=Refused unless noted):**
- \`BPHIGH6\` (told high BP — special: 1=Yes, 2=Yes but only during pregnancy, 3=No, 4=Borderline, 7=DK, 9=Refused — available 2015, 2017, 2019, 2023 only)
- \`CVDINFR4\` (heart attack)
- \`CVDCRHD4\` (coronary heart disease)
- \`CVDSTRK3\` (stroke)
- \`ASTHMA3\` (ever told asthma)
- \`ASTHNOW\` (still have asthma)
- \`DIABETE4\` (diabetes: 1=Yes, 2=Yes only during pregnancy, 3=No, 4=Pre-diabetes, 7=DK, 9=Refused)
- \`CHCCOPD3\` (COPD/emphysema/chronic bronchitis — available 2019+ only)
- \`ADDEPEV3\` (depressive disorder — available 2019+ only)
- \`CHCKDNY2\` (kidney disease — available 2019+ only)
- \`HAVARTH4\` (arthritis)
- \`CHCSCNC1\` (skin cancer)
- \`CHCOCNC1\` (other cancer)
- \`_MICHD\` (calculated: myocardial infarction or CHD: 1=Yes, 2=No — available 2017+ only)

**Health Care Access:**
- \`PRIMINS1\` (primary insurance: 1-10 various types, 88=No coverage — 2023 ONLY)
- \`PERSDOC3\` (personal doctor: 1=Yes one, 2=Yes more than one, 3=No, 7=DK, 9=Refused)
- \`MEDCOST1\` (couldn't see doctor due to cost: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`CHECKUP1\` (last routine checkup: 1=Within past year, 2=1-2 years, 3=2-5 years, 4=5+ years, 7=DK, 8=Never, 9=Refused)
- \`_HLTHPL1\` (calculated: has any health plan: 1=Yes, 2=No, 9=DK — available 2019+ only)
- \`_HCVU653\` (calculated: health care coverage 18-64: 1=Yes, 2=No, 9=DK)

**Behavioral Risk Factors:**
- \`EXERANY2\` (exercise in past 30 days: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`_TOTINDA\` (calculated: leisure time physical activity: 1=Had activity, 2=No activity, 9=DK)
- \`SMOKE100\` (smoked 100+ cigarettes ever: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`_SMOKER3\` (calculated: 1=Current daily, 2=Current some days, 3=Former, 4=Never, 9=DK)
- \`_CURECI2\` (calculated current e-cigarette user: 1=Current daily, 2=Current some days, 3=Former, 4=Never, 9=DK — 2023 ONLY)
- \`ALCDAY4\` (days per week/month: 101-199=days/week, 201-299=days/month, 888=None past 30, 777=DK, 999=Refused)
- \`_RFBING6\` (calculated binge drinker: 1=No, 2=Yes, 9=DK)
- \`_RFDRHV8\` (calculated heavy drinker: 1=No, 2=Yes, 9=DK — available 2015+ only)
- \`_DRNKWK2\` (calculated drinks per week, continuous, 99900=DK — available 2015+ only)

**BMI:**
- \`_BMI5\` (calculated BMI * 100, e.g. 2500 = 25.00)
- \`_BMI5CAT\` (1=Underweight, 2=Normal, 3=Overweight, 4=Obese, BLANK=DK)
- \`_RFBMI5\` (calculated: 1=Not overweight/obese, 2=Overweight/obese, 9=DK)

**Preventive Care:**
- \`FLUSHOT7\` (flu shot past 12 months: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`PNEUVAC4\` (pneumonia vaccine ever: 1=Yes, 2=No, 7=DK, 9=Refused — available 2018+ only)
- \`HIVTST7\` (ever tested for HIV: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`_FLSHOT7\` (calculated flu shot: 1=Yes, 2=No, 9=DK)

**Disability:**
- \`DEAF\` (deaf or serious hearing difficulty: 1=Yes, 2=No, 7=DK, 9=Refused — available 2015+ only)
- \`BLIND\` (blind or serious vision difficulty: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`DIFFWALK\` (serious difficulty walking: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`DIFFDRES\` (difficulty dressing: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`DIFFALON\` (difficulty doing errands alone: 1=Yes, 2=No, 7=DK, 9=Refused)
- \`DECIDE\` (difficulty concentrating: 1=Yes, 2=No, 7=DK, 9=Refused)

**Seatbelt:**
- \`SEATBELT\` (1=Always, 2=Nearly always, 3=Sometimes, 4=Seldom, 5=Never, 7=DK, 8=Never drive/ride, 9=Refused — not available in 2019)

**Survey Design:**
- \`_LLCPWT\` (final weight — ALWAYS use for estimates)
- \`_STSTR\` (sample design stratification)
- \`_PSU\` (primary sampling unit)

---

### State FIPS Lookup

Use CASE WHEN for state labels. Key mappings:
1=AL, 2=AK, 4=AZ, 5=AR, 6=CA, 8=CO, 9=CT, 10=DE, 11=DC, 12=FL,
13=GA, 15=HI, 16=ID, 17=IL, 18=IN, 19=IA, 20=KS, 21=KY, 22=LA,
23=ME, 24=MD, 25=MA, 26=MI, 27=MN, 28=MS, 29=MO, 30=MT, 31=NE,
32=NV, 33=NH, 34=NJ, 35=NM, 36=NY, 37=NC, 38=ND, 39=OH, 40=OK,
41=OR, 42=PA, 44=RI, 45=SC, 46=SD, 47=TN, 48=TX, 49=UT, 50=VT,
51=VA, 53=WA, 54=WV, 55=WI, 56=WY, 66=GU, 72=PR, 78=VI

Example state label:
\`\`\`sql
CASE _STATE
  WHEN 1 THEN 'Alabama' WHEN 2 THEN 'Alaska' WHEN 4 THEN 'Arizona'
  WHEN 5 THEN 'Arkansas' WHEN 6 THEN 'California' WHEN 8 THEN 'Colorado'
  WHEN 9 THEN 'Connecticut' WHEN 10 THEN 'Delaware' WHEN 11 THEN 'DC'
  WHEN 12 THEN 'Florida' WHEN 13 THEN 'Georgia' WHEN 15 THEN 'Hawaii'
  WHEN 16 THEN 'Idaho' WHEN 17 THEN 'Illinois' WHEN 18 THEN 'Indiana'
  WHEN 19 THEN 'Iowa' WHEN 20 THEN 'Kansas' WHEN 21 THEN 'Kentucky'
  WHEN 22 THEN 'Louisiana' WHEN 23 THEN 'Maine' WHEN 24 THEN 'Maryland'
  WHEN 25 THEN 'Massachusetts' WHEN 26 THEN 'Michigan' WHEN 27 THEN 'Minnesota'
  WHEN 28 THEN 'Mississippi' WHEN 29 THEN 'Missouri' WHEN 30 THEN 'Montana'
  WHEN 31 THEN 'Nebraska' WHEN 32 THEN 'Nevada' WHEN 33 THEN 'New Hampshire'
  WHEN 34 THEN 'New Jersey' WHEN 35 THEN 'New Mexico' WHEN 36 THEN 'New York'
  WHEN 37 THEN 'North Carolina' WHEN 38 THEN 'North Dakota' WHEN 39 THEN 'Ohio'
  WHEN 40 THEN 'Oklahoma' WHEN 41 THEN 'Oregon' WHEN 42 THEN 'Pennsylvania'
  WHEN 44 THEN 'Rhode Island' WHEN 45 THEN 'South Carolina' WHEN 46 THEN 'South Dakota'
  WHEN 47 THEN 'Tennessee' WHEN 48 THEN 'Texas' WHEN 49 THEN 'Utah'
  WHEN 50 THEN 'Vermont' WHEN 51 THEN 'Virginia' WHEN 53 THEN 'Washington'
  WHEN 54 THEN 'West Virginia' WHEN 55 THEN 'Wisconsin' WHEN 56 THEN 'Wyoming'
  WHEN 66 THEN 'Guam' WHEN 72 THEN 'Puerto Rico' WHEN 78 THEN 'US Virgin Islands'
  ELSE 'Other'
END AS state_name
\`\`\`

---

### SQL Examples

**Weighted diabetes prevalence by age group:**
\`\`\`sql
SELECT
  CASE _AGE_G WHEN 1 THEN '18-24' WHEN 2 THEN '25-34' WHEN 3 THEN '35-44'
    WHEN 4 THEN '45-54' WHEN 5 THEN '55-64' WHEN 6 THEN '65+' END AS age_group,
  ROUND(100.0 * SUM(CASE WHEN DIABETE4 = 1 THEN _LLCPWT ELSE 0 END)
    / NULLIF(SUM(CASE WHEN DIABETE4 IN (1, 3) THEN _LLCPWT ELSE 0 END), 0), 1) AS diabetes_pct,
  COUNT(*) FILTER (WHERE DIABETE4 IN (1, 3)) AS sample_n
FROM brfss
WHERE _AGE_G BETWEEN 1 AND 6
GROUP BY _AGE_G
ORDER BY _AGE_G
\`\`\`

**Obesity rate trend by year:**
\`\`\`sql
SELECT
  survey_year,
  ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
    / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct,
  COUNT(*) FILTER (WHERE _BMI5CAT BETWEEN 1 AND 4) AS sample_n
FROM brfss
GROUP BY survey_year
ORDER BY survey_year
\`\`\`

**States with highest obesity rates:**
\`\`\`sql
SELECT
  CASE _STATE WHEN 1 THEN 'Alabama' ... END AS state_name,
  ROUND(100.0 * SUM(CASE WHEN _BMI5CAT = 4 THEN _LLCPWT ELSE 0 END)
    / NULLIF(SUM(CASE WHEN _BMI5CAT BETWEEN 1 AND 4 THEN _LLCPWT ELSE 0 END), 0), 1) AS obesity_pct
FROM brfss
WHERE _BMI5CAT BETWEEN 1 AND 4
GROUP BY _STATE
ORDER BY obesity_pct DESC
LIMIT 10
\`\`\`

**Poor mental health days by income:**
\`\`\`sql
SELECT
  CASE _INCOMG WHEN 1 THEN '<$15K' WHEN 2 THEN '$15-25K' WHEN 3 THEN '$25-35K'
    WHEN 4 THEN '$35-50K' WHEN 5 THEN '$50K+' END AS income_group,
  ROUND(SUM(CASE WHEN MENTHLTH BETWEEN 1 AND 30 THEN MENTHLTH * _LLCPWT
    WHEN MENTHLTH = 88 THEN 0 ELSE NULL END)
    / NULLIF(SUM(CASE WHEN MENTHLTH BETWEEN 0 AND 30 OR MENTHLTH = 88 THEN _LLCPWT ELSE NULL END), 0), 1) AS avg_poor_mental_health_days
FROM brfss
WHERE _INCOMG BETWEEN 1 AND 5 AND survey_year BETWEEN 2014 AND 2020
GROUP BY _INCOMG
ORDER BY _INCOMG
\`\`\`

---

### Rules
- Return ONLY SQL, no markdown or explanation.
- If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: <short reason>.
- SELECT queries only. Use DuckDB SQL syntax.
- Always include LIMIT (max 10000), unless the query is a single aggregated row.
- ALWAYS use _LLCPWT for weighted estimates. Never report unweighted counts as prevalence.
- ALWAYS exclude DK/Refused codes (7, 9, 77, 99 as appropriate) from calculations.
- ALWAYS add readable labels via CASE WHEN — never return raw numeric codes.
- Prefer calculated variables (prefixed with _) when available — they are pre-cleaned by CDC.
- For days variables (PHYSHLTH, MENTHLTH, POORHLTH), treat 88 as 0 days and exclude 77/99.
- For ALCDAY4, decode: values 101-107 mean 1-7 days/week, 201-230 mean 1-30 days/month, 888=None.
- When the user asks about trends over time, GROUP BY survey_year. Note the 2021-2022 gap.
- When a column is only available in certain years (e.g., INCOME3 is 2023 only), filter to those years or return CANNOT_ANSWER if the user's question requires cross-year comparison with that variable.
- For income analysis across all years, use INCOME2/\`_INCOMG\` for 2014-2020 and INCOME3/\`_INCOMG1\` for 2023. Do NOT use both in the same query without careful binning.
- When the user asks about a specific year, always add \`WHERE survey_year = <year>\`.`;
}
