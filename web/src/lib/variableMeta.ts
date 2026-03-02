export interface VariableInfo {
  name: string;
  description: string;
  type?: string;
  codes?: string;
  note?: string;
}

export interface VariableGroup {
  name: string;
  description?: string;
  variables: VariableInfo[];
}

export const medicaidVariableGroups: VariableGroup[] = [
  {
    name: "Claims",
    description: "Raw Medicaid provider spending data — 227M rows, one per provider + procedure + month (Jan 2018 – Dec 2024)",
    variables: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit NPI number)" },
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code (e.g. '99213', 'J0178')" },
      { name: "claim_month", type: "DATE", description: "Month of claims (first day of month, e.g. 2024-01-01)" },
      { name: "total_paid", type: "DOUBLE", description: "Total Medicaid payments in dollars" },
      { name: "total_claims", type: "BIGINT", description: "Total number of claims" },
      { name: "unique_beneficiaries", type: "BIGINT", description: "Number of unique beneficiaries" },
    ],
  },
  {
    name: "HCPCS Lookup",
    description: "Maps HCPCS/CPT codes to English descriptions (~17.5K rows)",
    variables: [
      { name: "hcpcs_code", type: "VARCHAR", description: "HCPCS/CPT procedure code" },
      { name: "description", type: "VARCHAR", description: "Short English description of the procedure" },
    ],
  },
  {
    name: "NPI Lookup",
    description: "Maps billing NPI numbers to provider names, type, and location (~615K rows)",
    variables: [
      { name: "billing_npi", type: "VARCHAR", description: "National Provider Identifier (10-digit)" },
      { name: "provider_name", type: "VARCHAR", description: "Provider or organization name" },
      { name: "provider_type", type: "VARCHAR", description: "Individual or Organization" },
      { name: "city", type: "VARCHAR", description: "Practice location city" },
      { name: "state", type: "VARCHAR", description: "Practice location state (2-letter abbreviation)" },
    ],
  },
  {
    name: "State Population",
    description: "US state population and Medicaid enrollment (2023 Census estimates, 52 rows)",
    variables: [
      { name: "state", type: "VARCHAR", description: "2-letter state abbreviation" },
      { name: "state_name", type: "VARCHAR", description: "Full state name" },
      { name: "population_2023", type: "BIGINT", description: "Total state population (2023 Census estimate)" },
      { name: "medicaid_enrollment_2023", type: "BIGINT", description: "Medicaid enrollment count (2023)" },
    ],
  },
];

export const brfssVariableGroups: VariableGroup[] = [
  {
    name: "Survey Year",
    description: "Year identifier for multi-year analysis",
    variables: [
      { name: "survey_year", type: "INTEGER", description: "Survey year", codes: "2014–2020, 2023 (2021-2022 excluded)" },
    ],
  },
  {
    name: "Demographics",
    description: "Age, sex, race, education, employment, and household characteristics",
    variables: [
      { name: "_STATE", type: "INTEGER", description: "State FIPS code", codes: "1=AL, 6=CA, 36=NY, etc." },
      { name: "SEXVAR", type: "INTEGER", description: "Sex of respondent", codes: "1=Male, 2=Female" },
      { name: "_SEX", type: "INTEGER", description: "Calculated sex (same coding as SEXVAR)", note: "2019+ only" },
      { name: "_AGEG5YR", type: "INTEGER", description: "5-year age groups", codes: "1=18-24, 2=25-29, … 13=80+, 14=DK" },
      { name: "_AGE80", type: "INTEGER", description: "Imputed age in years, top-coded at 80" },
      { name: "_AGE_G", type: "INTEGER", description: "6 age groups", codes: "1=18-24, 2=25-34, 3=35-44, 4=45-54, 5=55-64, 6=65+" },
      { name: "_IMPRACE", type: "INTEGER", description: "Imputed race/ethnicity", codes: "1=White, 2=Black, 3=Asian, 4=AI/AN, 5=Hispanic, 6=Other", note: "2014, 2017+ only" },
      { name: "_RACEGR3", type: "INTEGER", description: "Race/ethnicity groups", codes: "1=White, 2=Black, 3=Other, 4=Multiracial, 5=Hispanic" },
      { name: "EDUCA", type: "INTEGER", description: "Education level", codes: "1=Never attended, 2=Grades 1-8, 3=Grades 9-11, 4=HS grad, 5=Some college, 6=College grad" },
      { name: "_EDUCAG", type: "INTEGER", description: "Education grouped", codes: "1=Did not graduate HS, 2=Graduated HS, 3=Attended college, 4=Graduated college" },
      { name: "MARITAL", type: "INTEGER", description: "Marital status", codes: "1=Married, 2=Divorced, 3=Widowed, 4=Separated, 5=Never married, 6=Unmarried couple" },
      { name: "EMPLOY1", type: "INTEGER", description: "Employment status", codes: "1=Employed, 2=Self-employed, 3=Unemployed 1yr+, 4=Unemployed <1yr, 5=Homemaker, 6=Student, 7=Retired, 8=Unable to work" },
      { name: "VETERAN3", type: "INTEGER", description: "Veteran status", codes: "1=Yes, 2=No" },
      { name: "CHILDREN", type: "INTEGER", description: "Number of children in household", codes: "0-87 count, 88=None" },
    ],
  },
  {
    name: "Income",
    description: "Household income — coding changed between survey eras",
    variables: [
      { name: "INCOME2", type: "INTEGER", description: "Household income (8 categories)", codes: "1=<$10K, 2=$10-15K, 3=$15-20K, 4=$20-25K, 5=$25-35K, 6=$35-50K, 7=$50-75K, 8=$75K+", note: "2014-2020 only" },
      { name: "INCOME3", type: "INTEGER", description: "Household income (11 categories)", codes: "1=<$10K, … 8=$75-100K, 9=$100-150K, 10=$150-200K, 11=$200K+", note: "2023 only" },
      { name: "_INCOMG", type: "INTEGER", description: "Income grouped (5 categories)", codes: "1=<$15K, 2=$15-25K, 3=$25-35K, 4=$35-50K, 5=$50K+", note: "2014-2020 only" },
      { name: "_INCOMG1", type: "INTEGER", description: "Income grouped (7 categories)", codes: "1=<$15K, 2=$15-25K, 3=$25-35K, 4=$35-50K, 5=$50-100K, 6=$100-200K, 7=$200K+", note: "2023 only" },
    ],
  },
  {
    name: "General Health",
    description: "Self-rated health status and days of poor health",
    variables: [
      { name: "GENHLTH", type: "INTEGER", description: "General health status", codes: "1=Excellent, 2=Very good, 3=Good, 4=Fair, 5=Poor" },
      { name: "PHYSHLTH", type: "INTEGER", description: "Days of poor physical health in past 30", codes: "1-30 days, 88=None" },
      { name: "MENTHLTH", type: "INTEGER", description: "Days of poor mental health in past 30", codes: "1-30 days, 88=None" },
      { name: "POORHLTH", type: "INTEGER", description: "Days poor health prevented activities", codes: "1-30 days, 88=None" },
      { name: "_RFHLTH", type: "INTEGER", description: "Good or better health (calculated)", codes: "1=Good or better, 2=Fair or poor" },
      { name: "_PHYS14D", type: "INTEGER", description: "14+ days poor physical health (calculated)", codes: "1=0-13 days, 2=14+ days", note: "2015+ only" },
      { name: "_MENT14D", type: "INTEGER", description: "14+ days poor mental health (calculated)", codes: "1=0-13 days, 2=14+ days", note: "2015+ only" },
    ],
  },
  {
    name: "Chronic Conditions",
    description: "Doctor-diagnosed chronic diseases and conditions",
    variables: [
      { name: "BPHIGH6", type: "INTEGER", description: "Told high blood pressure", codes: "1=Yes, 2=During pregnancy only, 3=No, 4=Borderline", note: "2015, 2017, 2019, 2023" },
      { name: "CVDINFR4", type: "INTEGER", description: "Heart attack (myocardial infarction)", codes: "1=Yes, 2=No" },
      { name: "CVDCRHD4", type: "INTEGER", description: "Coronary heart disease", codes: "1=Yes, 2=No" },
      { name: "CVDSTRK3", type: "INTEGER", description: "Stroke", codes: "1=Yes, 2=No" },
      { name: "ASTHMA3", type: "INTEGER", description: "Ever told asthma", codes: "1=Yes, 2=No" },
      { name: "ASTHNOW", type: "INTEGER", description: "Still have asthma", codes: "1=Yes, 2=No" },
      { name: "DIABETE4", type: "INTEGER", description: "Diabetes", codes: "1=Yes, 2=During pregnancy only, 3=No, 4=Pre-diabetes" },
      { name: "CHCCOPD3", type: "INTEGER", description: "COPD / emphysema / chronic bronchitis", codes: "1=Yes, 2=No", note: "2019+ only" },
      { name: "ADDEPEV3", type: "INTEGER", description: "Depressive disorder", codes: "1=Yes, 2=No", note: "2019+ only" },
      { name: "CHCKDNY2", type: "INTEGER", description: "Kidney disease", codes: "1=Yes, 2=No", note: "2019+ only" },
      { name: "HAVARTH4", type: "INTEGER", description: "Arthritis", codes: "1=Yes, 2=No" },
      { name: "CHCSCNC1", type: "INTEGER", description: "Skin cancer", codes: "1=Yes, 2=No" },
      { name: "CHCOCNC1", type: "INTEGER", description: "Other cancer", codes: "1=Yes, 2=No" },
      { name: "_MICHD", type: "INTEGER", description: "MI or CHD (calculated)", codes: "1=Yes, 2=No", note: "2017+ only" },
    ],
  },
  {
    name: "Health Care Access",
    description: "Insurance, doctor access, and preventive checkups",
    variables: [
      { name: "PRIMINS1", type: "INTEGER", description: "Primary insurance type", codes: "1-10 various types, 88=No coverage", note: "2023 only" },
      { name: "PERSDOC3", type: "INTEGER", description: "Has personal doctor", codes: "1=Yes one, 2=Yes more than one, 3=No" },
      { name: "MEDCOST1", type: "INTEGER", description: "Couldn't see doctor due to cost", codes: "1=Yes, 2=No" },
      { name: "CHECKUP1", type: "INTEGER", description: "Last routine checkup", codes: "1=Past year, 2=1-2 yrs, 3=2-5 yrs, 4=5+ yrs, 8=Never" },
      { name: "_HLTHPL1", type: "INTEGER", description: "Has any health plan (calculated)", codes: "1=Yes, 2=No", note: "2019+ only" },
      { name: "_HCVU653", type: "INTEGER", description: "Health care coverage ages 18-64 (calculated)", codes: "1=Yes, 2=No" },
    ],
  },
  {
    name: "Behavioral Risk Factors",
    description: "Exercise, smoking, e-cigarettes, and alcohol use",
    variables: [
      { name: "EXERANY2", type: "INTEGER", description: "Exercise in past 30 days", codes: "1=Yes, 2=No" },
      { name: "_TOTINDA", type: "INTEGER", description: "Leisure time physical activity (calculated)", codes: "1=Had activity, 2=No activity" },
      { name: "SMOKE100", type: "INTEGER", description: "Smoked 100+ cigarettes ever", codes: "1=Yes, 2=No" },
      { name: "_SMOKER3", type: "INTEGER", description: "Smoking status (calculated)", codes: "1=Current daily, 2=Current some days, 3=Former, 4=Never" },
      { name: "_CURECI2", type: "INTEGER", description: "E-cigarette use (calculated)", codes: "1=Current daily, 2=Current some days, 3=Former, 4=Never", note: "2023 only" },
      { name: "ALCDAY4", type: "INTEGER", description: "Alcohol drinking days per week/month", codes: "101-107=days/week, 201-230=days/month, 888=None" },
      { name: "_RFBING6", type: "INTEGER", description: "Binge drinker (calculated)", codes: "1=No, 2=Yes" },
      { name: "_RFDRHV8", type: "INTEGER", description: "Heavy drinker (calculated)", codes: "1=No, 2=Yes", note: "2015+ only" },
      { name: "_DRNKWK2", type: "INTEGER", description: "Drinks per week (calculated, continuous)", note: "2015+ only" },
    ],
  },
  {
    name: "BMI",
    description: "Body mass index measures",
    variables: [
      { name: "_BMI5", type: "INTEGER", description: "BMI × 100 (e.g. 2500 = 25.00)" },
      { name: "_BMI5CAT", type: "INTEGER", description: "BMI category", codes: "1=Underweight, 2=Normal, 3=Overweight, 4=Obese" },
      { name: "_RFBMI5", type: "INTEGER", description: "Overweight or obese (calculated)", codes: "1=No, 2=Yes" },
    ],
  },
  {
    name: "Preventive Care",
    description: "Vaccination and screening",
    variables: [
      { name: "FLUSHOT7", type: "INTEGER", description: "Flu shot in past 12 months", codes: "1=Yes, 2=No" },
      { name: "PNEUVAC4", type: "INTEGER", description: "Pneumonia vaccine ever", codes: "1=Yes, 2=No", note: "2018+ only" },
      { name: "HIVTST7", type: "INTEGER", description: "Ever tested for HIV", codes: "1=Yes, 2=No" },
      { name: "_FLSHOT7", type: "INTEGER", description: "Flu shot (calculated)", codes: "1=Yes, 2=No" },
    ],
  },
  {
    name: "Disability",
    description: "Functional limitations and difficulties",
    variables: [
      { name: "DEAF", type: "INTEGER", description: "Deaf or serious hearing difficulty", codes: "1=Yes, 2=No", note: "2015+ only" },
      { name: "BLIND", type: "INTEGER", description: "Blind or serious vision difficulty", codes: "1=Yes, 2=No" },
      { name: "DIFFWALK", type: "INTEGER", description: "Serious difficulty walking", codes: "1=Yes, 2=No" },
      { name: "DIFFDRES", type: "INTEGER", description: "Difficulty dressing", codes: "1=Yes, 2=No" },
      { name: "DIFFALON", type: "INTEGER", description: "Difficulty doing errands alone", codes: "1=Yes, 2=No" },
      { name: "DECIDE", type: "INTEGER", description: "Difficulty concentrating/remembering", codes: "1=Yes, 2=No" },
    ],
  },
  {
    name: "Seatbelt",
    variables: [
      { name: "SEATBELT", type: "INTEGER", description: "Seatbelt use frequency", codes: "1=Always, 2=Nearly always, 3=Sometimes, 4=Seldom, 5=Never, 8=Never drive", note: "Not in 2019" },
    ],
  },
  {
    name: "Survey Design",
    description: "Weighting and sampling variables",
    variables: [
      { name: "_LLCPWT", type: "DOUBLE", description: "Final survey weight — always use for population estimates" },
      { name: "_STSTR", type: "INTEGER", description: "Sample design stratification variable" },
      { name: "_PSU", type: "INTEGER", description: "Primary sampling unit" },
    ],
  },
];

export const medicareVariableGroups: VariableGroup[] = [
  {
    name: "Provider Identity",
    description: "NPI, name, credentials, specialty, and entity type",
    variables: [
      { name: "Rndrng_NPI", type: "VARCHAR", description: "National Provider Identifier (10-digit)" },
      { name: "Rndrng_Prvdr_Last_Org_Name", type: "VARCHAR", description: "Last name or organization name" },
      { name: "Rndrng_Prvdr_First_Name", type: "VARCHAR", description: "First name (NULL for organizations)" },
      { name: "Rndrng_Prvdr_MI", type: "VARCHAR", description: "Middle initial" },
      { name: "Rndrng_Prvdr_Crdntls", type: "VARCHAR", description: "Credentials (e.g. M.D., D.O., N.P.)" },
      { name: "Rndrng_Prvdr_Ent_Cd", type: "VARCHAR", description: "Entity type", codes: "I=Individual, O=Organization" },
      { name: "Rndrng_Prvdr_Type", type: "VARCHAR", description: "Provider specialty (e.g. Internal Medicine, Cardiology)" },
      { name: "Rndrng_Prvdr_Mdcr_Prtcptg_Ind", type: "VARCHAR", description: "Medicare participating provider", codes: "Y=Yes, N=No" },
    ],
  },
  {
    name: "Provider Location",
    description: "Address, state, ZIP, and rural/urban classification",
    variables: [
      { name: "Rndrng_Prvdr_St1", type: "VARCHAR", description: "Street address line 1" },
      { name: "Rndrng_Prvdr_St2", type: "VARCHAR", description: "Street address line 2" },
      { name: "Rndrng_Prvdr_City", type: "VARCHAR", description: "City" },
      { name: "Rndrng_Prvdr_State_Abrvtn", type: "VARCHAR", description: "State abbreviation (e.g. CA, NY)" },
      { name: "Rndrng_Prvdr_State_FIPS", type: "VARCHAR", description: "State FIPS code" },
      { name: "Rndrng_Prvdr_Zip5", type: "VARCHAR", description: "5-digit ZIP code" },
      { name: "Rndrng_Prvdr_RUCA", type: "VARCHAR", description: "Rural-Urban Commuting Area code" },
      { name: "Rndrng_Prvdr_RUCA_Desc", type: "VARCHAR", description: "RUCA description (Metropolitan, Micropolitan, Small town, Rural)" },
      { name: "Rndrng_Prvdr_Cntry", type: "VARCHAR", description: "Country code (mostly US)" },
    ],
  },
  {
    name: "Service",
    description: "HCPCS procedure code, description, and place of service",
    variables: [
      { name: "HCPCS_Cd", type: "VARCHAR", description: "HCPCS/CPT procedure code" },
      { name: "HCPCS_Desc", type: "VARCHAR", description: "Procedure description" },
      { name: "HCPCS_Drug_Ind", type: "VARCHAR", description: "Drug/biological indicator", codes: "Y=Drug, N=Non-drug" },
      { name: "Place_Of_Srvc", type: "VARCHAR", description: "Place of service", codes: "F=Facility (hospital outpatient), O=Office" },
    ],
  },
  {
    name: "Volume & Payment",
    description: "Service counts and per-service payment averages (multiply by Tot_Srvcs for totals)",
    variables: [
      { name: "Tot_Benes", type: "INTEGER", description: "Unique Medicare beneficiaries (minimum 11 per row)" },
      { name: "Tot_Srvcs", type: "DOUBLE", description: "Total number of services rendered" },
      { name: "Tot_Bene_Day_Srvcs", type: "DOUBLE", description: "Total distinct beneficiary/day services" },
      { name: "Avg_Sbmtd_Chrg", type: "DOUBLE", description: "Average submitted charge per service (provider billed amount)" },
      { name: "Avg_Mdcr_Alowd_Amt", type: "DOUBLE", description: "Average Medicare allowed amount per service (negotiated rate)" },
      { name: "Avg_Mdcr_Pymt_Amt", type: "DOUBLE", description: "Average Medicare payment per service (actual payment)" },
      { name: "Avg_Mdcr_Stdzd_Amt", type: "DOUBLE", description: "Average standardized payment (geographic adjustment removed)" },
    ],
  },
  {
    name: "Data Year",
    variables: [
      { name: "data_year", type: "INTEGER", description: "Year of data (2023)" },
    ],
  },
];
