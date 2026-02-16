/**
 * Pre-checks whether a user's question is obviously outside the scope of the dataset.
 * Only rejects when we are CERTAIN the data cannot produce valid results.
 * Returns null if the question is fine, or an error message string if it should be rejected.
 */

interface ScopeRule {
  pattern: RegExp;
  message: string;
}

const OUT_OF_SCOPE_RULES: ScopeRule[] = [
  // Diagnosis / ICD codes — no diagnosis data at all
  {
    pattern: /\b(diagnos[ei]s|icd[- ]?10|icd[- ]?9|diagnostic code|disease code|comorbid|condition code)\b/i,
    message:
      "This dataset does not contain diagnosis or ICD codes. It only has HCPCS/CPT procedure codes, so questions about specific diagnoses or disease codes cannot be answered.",
  },
  // DRG / hospital facility costs
  {
    pattern: /\b(drg|diagnosis[- ]related group|hospital facility|room and board|facility (fee|cost|charge|payment))\b/i,
    message:
      "This dataset does not contain DRG (Diagnosis Related Group) codes or hospital facility charges. It only covers HCPCS/CPT-billed professional and provider claims — not the facility component of hospital stays.",
  },
  // Patient demographics
  {
    pattern: /\b(patient age|patient gender|patient race|patient ethnicit|patient demographic|age group|age bracket|\bage\b.{0,15}\b(of|over|under|between)\b.{0,10}\b(patient|beneficiar|enrolle))\b/i,
    message:
      "This dataset does not contain patient demographics (age, gender, race, ethnicity). It only tracks provider billing data: NPI, procedure code, payment amounts, and claim counts.",
  },
  // Pharmacy / prescription drug fills (not J-codes)
  {
    pattern: /\b(pharmacy|prescription fill|drug name|medication name|retail pharmacy|pharmacy benefit|part d|prescription drug plan|pill|tablet|capsule|refill|dispensing fee|ndc code|national drug code)\b/i,
    message:
      "This dataset does not contain pharmacy prescription fills or retail drug data. It only includes provider-administered drugs billed via J-codes (injections/infusions given in clinical settings), not pharmacy counter prescriptions.",
  },
  // Clinical outcomes
  {
    pattern: /\b(mortality|death rate|survival rate|readmission rate|complication rate|patient outcome|clinical outcome|length of stay|los\b|hospital stay duration|quality measure|quality score|star rating)\b/i,
    message:
      "This dataset does not contain clinical outcomes, quality measures, or patient health results. It only tracks billing data: what was billed, how much was paid, and how many claims/beneficiaries.",
  },
  // Payer mix / insurance type
  {
    pattern: /\b(dual[- ]?eligible|medicare.{0,10}medicaid|payer mix|payer type|insurance type|managed care org|mco\b|fee[- ]?for[- ]?service vs|capitat)/i,
    message:
      "This dataset does not distinguish between payer types, managed care vs. fee-for-service, or dual-eligible status. All records are Medicaid claims without further payer breakdown.",
  },
];

export function checkDataScope(question: string): string | null {
  const q = question.trim();
  for (const rule of OUT_OF_SCOPE_RULES) {
    if (rule.pattern.test(q)) {
      return rule.message;
    }
  }
  return null;
}
