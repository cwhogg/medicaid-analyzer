import Anthropic from "@anthropic-ai/sdk";

// --- Types ---

export interface ConceptExtraction {
  concepts: string[];
  dataFields: string[];
  variables: string[];
  timeRange: string | null;
  comparisonIntent: boolean;
  populationType: string | null;
}

export interface DatasetSelection {
  datasets: string[];
  reasoning: string;
  joinStrategy: "none" | "sql_join" | "parallel_queries" | "narrative_only";
  joinKeys: string[] | null;
  ambiguous: boolean;
  clarificationQuestion: string | null;
  confidence: "high" | "medium" | "low";
}

// --- Dataset Catalog (comprehensive with schemas) ---

const DATASET_CATALOG = `DATASET REFERENCE — 7 federal health datasets

═══ 1. medicaid ═══ Medicaid fee-for-service provider spending. 227M rows. Years: 2018–2024.
Table: claims
  billing_npi (VARCHAR) — National Provider Identifier
  hcpcs_code (VARCHAR) — HCPCS/CPT procedure code
  claim_month (DATE) — Month of claims (first day of month)
  total_paid (DOUBLE) — Total Medicaid payments in dollars
  total_claims (BIGINT) — Number of claims
  unique_beneficiaries (BIGINT) — Number of unique beneficiaries
Lookup tables: hcpcs_lookup (hcpcs_code → description), npi_lookup (billing_npi → provider name/type/state), state_population (state populations & Medicaid enrollment)
Key concepts: Medicaid payments, provider spending, procedure utilization, T-codes (personal care), J-codes (drugs/injections), telehealth, state-level spending.

═══ 2. medicare ═══ Medicare Part B physician/practitioner claims. 107M rows. Years: 2013–2023.
Table: medicare
  Rndrng_NPI (VARCHAR), Rndrng_Prvdr_Last_Org_Name, Rndrng_Prvdr_First_Name (VARCHAR)
  Rndrng_Prvdr_Type (VARCHAR) — Specialty (~100 categories)
  Rndrng_Prvdr_Ent_Cd (VARCHAR) — I=Individual, O=Organization
  Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_Zip5 (VARCHAR)
  Rndrng_Prvdr_RUCA_Desc (VARCHAR) — Rural-Urban classification
  HCPCS_Cd (VARCHAR) — Procedure code
  HCPCS_Desc (VARCHAR) — Procedure description
  Place_Of_Srvc (VARCHAR) — F=Facility, O=Office
  HCPCS_Drug_Ind (VARCHAR) — Y=drug/biological
  Tot_Benes (INTEGER) — Unique beneficiaries (min 11)
  Tot_Srvcs (DOUBLE) — Total services rendered
  Avg_Sbmtd_Chrg (DOUBLE) — Average submitted charge per service
  Avg_Mdcr_Pymt_Amt (DOUBLE) — Average Medicare payment per service
  Avg_Mdcr_Stdzd_Amt (DOUBLE) — Standardized payment (geographic adjustment removed)
  data_year (INTEGER)
IMPORTANT: Payment columns are AVERAGES — multiply by Tot_Srvcs for totals.

═══ 3. medicare-inpatient ═══ Medicare Part A hospital inpatient (DRG-based). 2M rows. Years: 2013–2023.
Table: medicare_inpatient
  Rndrng_Prvdr_CCN (VARCHAR) — CMS Certification Number (NOT NPI)
  Rndrng_Prvdr_Org_Name (VARCHAR) — Hospital name
  Rndrng_Prvdr_City, Rndrng_Prvdr_State_Abrvtn, Rndrng_Prvdr_Zip5 (VARCHAR)
  Rndrng_Prvdr_RUCA_Desc (VARCHAR)
  DRG_Cd (VARCHAR) — MS-DRG code (3-digit)
  DRG_Desc (VARCHAR) — DRG description (e.g. "HEART FAILURE & SHOCK W MCC")
  Tot_Dschrgs (INTEGER) — Total discharges (min 11)
  Avg_Submtd_Cvrd_Chrg (DOUBLE) — Average submitted charge per discharge
  Avg_Tot_Pymt_Amt (DOUBLE) — Average total payment (Medicare + beneficiary)
  Avg_Mdcr_Pymt_Amt (DOUBLE) — Average Medicare payment only
  data_year (INTEGER)
IMPORTANT: Uses hospital CCN, NOT NPI — cannot join to physician-level datasets on provider ID. Payment columns are AVERAGES — multiply by Tot_Dschrgs for totals.

═══ 4. medicare-partd ═══ Medicare Part D prescription drugs. 276M rows. Years: 2013–2023.
Table: medicare_partd
  Prscrbr_NPI (VARCHAR) — Prescriber NPI
  Prscrbr_Last_Org_Name, Prscrbr_First_Name (VARCHAR)
  Prscrbr_City, Prscrbr_State_Abrvtn, Prscrbr_State_FIPS (VARCHAR)
  Prscrbr_Type (VARCHAR) — Prescriber specialty
  Brnd_Name (VARCHAR) — Brand name (NULL for generic-only)
  Gnrc_Name (VARCHAR) — Generic/chemical name (always populated)
  Tot_Clms (BIGINT) — Total claims
  Tot_30day_Fills (DOUBLE) — 30-day standardized fills
  Tot_Day_Suply (BIGINT) — Total day supply
  Tot_Drug_Cst (DOUBLE) — Total drug cost (already a total, NOT an average)
  Tot_Benes (BIGINT) — Unique beneficiaries
  GE65_Tot_Clms, GE65_Tot_Drug_Cst, GE65_Tot_Benes — Age 65+ subset (may be suppressed)
  data_year (INTEGER)
Key concepts: drug spending, prescriptions, brand vs generic, opioids, insulin, GLP-1 drugs, specialty drugs, prescribing patterns.

═══ 5. brfss ═══ CDC BRFSS population health survey. 4M respondents. Years: 2014–2020, 2023–2024 (gap: no 2021-2022).
Table: brfss (99 columns)
  survey_year (INTEGER), _STATE (FIPS code)
  Demographics: SEXVAR (1=M,2=F), _AGEG5YR (age groups), _IMPRACE (race/ethnicity), EDUCA (education)
  Health status: GENHLTH (1=Excellent..5=Poor), PHYSHLTH (unhealthy days), MENTHLTH (unhealthy days)
  Chronic conditions: CVDINFR4 (heart attack), CVDCRHD4 (heart disease), CVDSTRK3 (stroke), DIABETE4 (diabetes), BPHIGH6 (high BP), ASTHMA3, CHCCOPD3 (COPD), ADDEPEV3 (depression), CHCKDNY2 (kidney disease), HAVARTH4 (arthritis)
  Behavioral: SMOKE100, _SMOKER3, EXERANY2, _TOTINDA, ALCDAY4, _RFBING6
  BMI: _BMI5 (BMI*100), _BMI5CAT (1=Under,2=Normal,3=Over,4=Obese)
  Preventive: FLUSHOT7, CHECKUP1, MEDCOST1 (couldn't afford doctor), PERSDOC3
  2024-only modules: SDOH (SDHBILLS, SDHFOOD1, etc.), ACEs (ACEDRINK, ACEDRUGS, etc.), Marijuana, Emotional support
  Survey weight: _LLCPWT (CRITICAL: always use for population estimates)
Key concepts: prevalence rates, self-reported conditions, health behaviors, risk factors, demographics, insurance coverage.

═══ 6. nhanes ═══ NHANES clinical examination survey. 12K participants. Cycle: 2021–2023 only (single cycle, no trends).
Table: nhanes (94 columns)
  Demographics: SEQN (respondent ID), RIAGENDR (1=M,2=F), RIDAGEYR (age), RIDRETH3 (race/ethnicity), DMDEDUC2, INDFMPIR (income-to-poverty ratio)
  Body measures: BMXWT (kg), BMXHT (cm), BMXBMI (kg/m²), BMXWAIST (cm)
  Blood pressure: BPXOSY1/2/3 (systolic), BPXODI1/2/3 (diastolic) — 3 readings each
  Diabetes: LBXGH (HbA1c %), LBXGLU (fasting glucose), LBXSGL (non-fasting glucose)
  Lipids: LBXTC (total cholesterol), LBDHDD (HDL), LBXTLG (triglycerides), LBDLDL (LDL)
  CBC: LBXWBCSI, LBXRBCSI, LBXHGB, LBXHCT, LBXPLTSI
  Kidney/liver: LBXSCR (creatinine), LBXSBU (BUN), LBXSUA (uric acid), LBXSATSI (ALT), LBXSASSI (AST)
  Inflammation: LBXHSCRP (hs-CRP)
  Self-reported: DIQ010 (diabetes), BPQ020 (high BP), MCQ160B (heart failure), MCQ160C (CHD), MCQ160E (heart attack), MCQ160F (stroke), MCQ220 (cancer)
  Depression: DPQ010-DPQ090 (PHQ-9 items, sum for total)
  Smoking: SMQ020 (ever smoked 100+), SMQ040 (current status)
  Survey weight: WTMEC2YR (for exam/lab data), WTINT2YR (for interview-only)
Key concepts: clinical measurements, lab values, undiagnosed conditions, objectively measured BMI/BP/cholesterol, depression screening.

═══ 7. dac ═══ CMS clinician directory. 2.8M rows. Current snapshot (no year dimension).
Table: dac
  npi (VARCHAR), provider_last_name, provider_first_name (VARCHAR)
  gndr (VARCHAR) — M/F
  cred (VARCHAR) — Credentials (MD, DO, NP, PA, etc.)
  med_sch (VARCHAR) — Medical school name
  grd_yr (VARCHAR) — Graduation year
  pri_spec (VARCHAR) — Primary specialty (ALL CAPS)
  sec_spec_1..4 (VARCHAR) — Secondary specialties
  telehlth (VARCHAR) — Y=Yes
  facility_name (VARCHAR) — Group practice/facility
  org_pac_id (VARCHAR) — Organization PECOS ID
  num_org_mem (INTEGER) — Members in organization
  city, state, zip_code (VARCHAR)
  ind_assgn (VARCHAR) — Y=accepts Medicare assignment
Key concepts: provider lookup, specialty counts, workforce demographics, telehealth adoption, medical school.

═══ CROSS-DATASET JOIN RULES ═══
- NPI joins: medicaid (billing_npi) ↔ medicare (Rndrng_NPI) ↔ medicare-partd (Prscrbr_NPI) ↔ dac (npi)
- HCPCS joins: medicaid (hcpcs_code) ↔ medicare (HCPCS_Cd)
- State joins: any dataset with state columns
- medicare-inpatient uses CCN (NOT NPI) — cannot join to physician-level datasets on provider ID
- brfss/nhanes have no provider identifiers — cannot join to claims data at row level
- brfss + nhanes can be compared narratively (both cover health conditions/behaviors) but NOT joined`;

// --- Concept Extraction ---

const CONCEPT_EXTRACTION_SYSTEM = `You extract structured concepts from natural language health data questions. Given a question and a dataset catalog, identify what the user is asking about.

${DATASET_CATALOG}

Respond with valid JSON only. No markdown, no code fences.

Response format:
{
  "concepts": ["list", "of", "key concepts"],
  "dataFields": ["data fields needed"],
  "variables": ["specific column names if identifiable"],
  "timeRange": "2023" or "2018-2024" or null,
  "comparisonIntent": true/false,
  "populationType": "providers" or "beneficiaries" or "general population" or "hospitals" or null
}

Rules:
- concepts: the core topics (e.g. "spending", "obesity", "drug costs", "comparison")
- dataFields: what data is needed (e.g. "HCPCS codes", "payment amounts", "survey weights")
- variables: only include if you can confidently identify specific column names from the catalog descriptions
- timeRange: extract explicit year references; null if none mentioned
- comparisonIntent: true if comparing across programs, datasets, or categories
- populationType: who/what the question is about`;

export async function extractConcepts(
  client: Anthropic,
  question: string,
): Promise<ConceptExtraction> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    temperature: 0,
    system: CONCEPT_EXTRACTION_SYSTEM,
    messages: [{ role: "user", content: question }],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No response from concept extraction");
  }

  let raw = text.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(raw);
  return {
    concepts: parsed.concepts || [],
    dataFields: parsed.dataFields || [],
    variables: parsed.variables || [],
    timeRange: parsed.timeRange || null,
    comparisonIntent: !!parsed.comparisonIntent,
    populationType: parsed.populationType || null,
  };
}

// --- Dataset Selection ---

const DATASET_SELECTION_SYSTEM = `You select which dataset(s) to query based on extracted concepts. You know these datasets:

${DATASET_CATALOG}

Key routing rules:
- "drug spending", "prescription", "drug costs", "brand vs generic", "opioid prescribing" → medicare-partd
- "hospital costs", "inpatient", "DRG", "discharge", "hip replacement hospital" → medicare-inpatient
- "physician spending", "Medicare doctor", "Medicare specialist", "Part B" → medicare
- "Medicaid", "T-codes", "personal care", "Medicaid provider" → medicaid
- "obesity rate", "smoking rate", "diabetes prevalence", "health behaviors", "survey" → brfss
- "blood pressure measurement", "lab values", "HbA1c", "clinical exam", "PHQ-9" → nhanes
- "how many doctors", "specialist count", "provider directory", "telehealth adoption" → dac
- Generic "Medicare spending" without qualifier → include medicare (Part B); add medicare-inpatient and/or medicare-partd only if context suggests hospital or drug spending
- "BMI" or "diabetes" without qualifier → ambiguous between brfss and nhanes (ask)
- Cross-program comparison (Medicaid vs Medicare) → multiple datasets
- Provider-level analysis across programs → sql_join on NPI (exclude inpatient — no NPI)
- Survey + claims combination → narrative_only (no shared identifiers)
- Medicare Inpatient uses CCN, NOT NPI — cannot join to physician-level datasets on provider ID
- BRFSS/NHANES have no provider identifiers — cannot join to claims at row level

Respond with valid JSON only. No markdown, no code fences.

Response format:
{
  "datasets": ["dataset-key-1", "dataset-key-2"],
  "reasoning": "Why these datasets",
  "joinStrategy": "none|sql_join|parallel_queries|narrative_only",
  "joinKeys": ["NPI"] or null,
  "ambiguous": true/false,
  "clarificationQuestion": "Question to ask user" or null,
  "confidence": "high|medium|low"
}

Rules:
- Maximum 3 datasets
- joinStrategy "sql_join" only when datasets share a key (NPI, state, HCPCS)
- joinStrategy "parallel_queries" when datasets cover the same concept but can't be joined (e.g. total Medicare = Part B + Inpatient + Part D separately)
- joinStrategy "narrative_only" when combining survey data with claims
- joinStrategy "none" for single-dataset queries
- Set ambiguous=true when confidence is low AND asking would genuinely help (not for every edge case)
- If user explicitly names a dataset, use it (high confidence)`;

export async function selectDatasets(
  client: Anthropic,
  concepts: ConceptExtraction,
  question: string,
): Promise<DatasetSelection> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    temperature: 0,
    system: DATASET_SELECTION_SYSTEM,
    messages: [{
      role: "user",
      content: `Original question: ${question}\n\nExtracted concepts: ${JSON.stringify(concepts)}`,
    }],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("No response from dataset selection");
  }

  let raw = text.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(raw);

  // Validate dataset keys
  const validKeys = new Set(["medicaid", "medicare", "medicare-inpatient", "medicare-partd", "brfss", "nhanes", "dac"]);
  const datasets = (parsed.datasets || []).filter((d: string) => validKeys.has(d));
  if (datasets.length === 0) {
    // Fallback to medicaid if nothing matched
    datasets.push("medicaid");
  }

  return {
    datasets,
    reasoning: parsed.reasoning || "",
    joinStrategy: parsed.joinStrategy || "none",
    joinKeys: parsed.joinKeys || null,
    ambiguous: !!parsed.ambiguous,
    clarificationQuestion: parsed.clarificationQuestion || null,
    confidence: parsed.confidence || "medium",
  };
}
