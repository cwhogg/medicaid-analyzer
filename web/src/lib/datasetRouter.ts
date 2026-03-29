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

// --- Dataset Catalog (compact, NOT schema-level) ---

const DATASET_CATALOG = `Datasets available:
1. medicaid — Medicaid fee-for-service provider spending. 227M claims rows.
   Covers: procedure-level spending (HCPCS/CPT codes), provider billing (by NPI),
   monthly trends, state-level analysis. Years: 2018-2024.
   Key concepts: Medicaid payments, provider spending, procedure utilization,
   beneficiary counts, T-codes (personal care), J-codes (drugs/injections).

2. medicare — Medicare Part B physician/practitioner claims. 107M rows.
   Covers: physician-level spending (HCPCS/CPT codes), specialty analysis,
   facility vs office, rural vs urban. Years: 2013-2023.
   Key concepts: Medicare physician payments, specialist billing, allowed amounts,
   standardized payments, provider specialty.

3. medicare-inpatient — Medicare Part A hospital inpatient (DRG-based). 2M rows.
   Covers: hospital discharge costs by DRG code, hospital comparisons,
   charge-to-payment ratios. Years: 2013-2023.
   Key concepts: hospital costs, inpatient stays, DRG codes, hospital charges.
   NOTE: Uses hospital CCN identifiers, NOT provider NPIs.

4. medicare-partd — Medicare Part D prescription drugs. 276M rows.
   Covers: drug costs by prescriber and drug name (brand + generic),
   prescribing patterns. Years: 2013-2023.
   Key concepts: drug spending, prescriptions, brand vs generic, opioids, insulin,
   GLP-1 drugs, specialty drugs.

5. brfss — CDC BRFSS population health survey. 4M respondents.
   Covers: self-reported health conditions, behaviors, risk factors, demographics.
   Years: 2014-2020, 2023-2024.
   Key concepts: prevalence rates, obesity, smoking, diabetes, mental health,
   exercise, insurance coverage. NOTE: Survey data — requires survey weights.

6. nhanes — NHANES clinical examination survey. 12K participants.
   Covers: measured clinical data (blood pressure, BMI, lab values), depression
   screening, health questionnaires. Cycle: 2021-2023 only.
   Key concepts: clinical measurements, lab values, undiagnosed conditions,
   BMI, cholesterol, HbA1c.

7. dac — CMS clinician directory. 2.8M rows.
   Covers: provider specialties, credentials, medical school, group practices,
   telehealth adoption, Medicare assignment. Current snapshot (no year dimension).
   Key concepts: provider lookup, specialty counts, workforce demographics.`;

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
    model: "claude-haiku-4-5-20251001",
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
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
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
