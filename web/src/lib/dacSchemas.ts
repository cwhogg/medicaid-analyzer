export function generateDACSchemaPrompt(): string {
  return `## CMS Doctors and Clinicians (DAC) National Downloadable File — 2026

You have ONE table: **dac** (~2.8M rows, 31 columns)

This dataset is a directory of all clinicians enrolled in Medicare. Each row represents a unique clinician/enrollment/group practice/address combination. A single NPI can appear on multiple rows if the clinician has multiple enrollment records, belongs to multiple group practices, or practices at multiple locations.

---

### CRITICAL: One NPI Can Have Multiple Rows

Because each row is a clinician+enrollment+group+address combination, you MUST use COUNT(DISTINCT npi) when counting unique clinicians — NOT COUNT(*).

**Counting clinicians correctly:**
\`\`\`sql
-- CORRECT: count unique clinicians
SELECT pri_spec, COUNT(DISTINCT npi) AS clinician_count
FROM dac GROUP BY pri_spec ORDER BY clinician_count DESC LIMIT 20

-- WRONG: counts enrollment/address records, not clinicians
SELECT pri_spec, COUNT(*) AS count FROM dac GROUP BY pri_spec
\`\`\`

---

### Columns

**Provider Identity:**
| Column | Type | Description |
|--------|------|-------------|
| npi | VARCHAR | National Provider Identifier (10-digit, unique per clinician) |
| ind_pac_id | VARCHAR | Individual PECOS Associate Control ID |
| ind_enrl_id | VARCHAR | Individual enrollment ID |
| provider_last_name | VARCHAR | Clinician last name |
| provider_first_name | VARCHAR | Clinician first name |
| provider_middle_name | VARCHAR | Clinician middle name (may be NULL) |
| suff | VARCHAR | Name suffix (Jr, Sr, III, etc.) |
| gndr | VARCHAR | Gender: M=Male, F=Female |
| cred | VARCHAR | Credentials (MD, DO, NP, PA, DPM, etc.) |

**Education:**
| Column | Type | Description |
|--------|------|-------------|
| med_sch | VARCHAR | Medical school name |
| grd_yr | VARCHAR | Graduation year (4-digit year as string) |

**Specialty:**
| Column | Type | Description |
|--------|------|-------------|
| pri_spec | VARCHAR | Primary specialty (e.g., INTERNAL MEDICINE, FAMILY PRACTICE, NURSE PRACTITIONER) |
| sec_spec_1 | VARCHAR | Secondary specialty 1 (may be NULL) |
| sec_spec_2 | VARCHAR | Secondary specialty 2 (may be NULL) |
| sec_spec_3 | VARCHAR | Secondary specialty 3 (may be NULL) |
| sec_spec_4 | VARCHAR | Secondary specialty 4 (may be NULL) |
| sec_spec_all | VARCHAR | All secondary specialties concatenated (may be NULL) |

**Telehealth:**
| Column | Type | Description |
|--------|------|-------------|
| telehlth | VARCHAR | Telehealth services indicator (Y=Yes, blank=No) |

**Organization/Group Practice:**
| Column | Type | Description |
|--------|------|-------------|
| facility_name | VARCHAR | Group practice or facility name (may be NULL for solo) |
| org_pac_id | VARCHAR | Organization PECOS Associate Control ID |
| num_org_mem | INTEGER | Number of members in the organization |

**Location:**
| Column | Type | Description |
|--------|------|-------------|
| adr_ln_1 | VARCHAR | Street address line 1 |
| adr_ln_2 | VARCHAR | Street address line 2 (may be NULL) |
| ln_2_sprs | VARCHAR | Line 2 suppression flag |
| city | VARCHAR | City name |
| state | VARCHAR | State abbreviation (2-letter, e.g., CA, NY, TX) |
| zip_code | VARCHAR | ZIP code (5 or 9 digit) |
| telephone | VARCHAR | Phone number (10 digits, no formatting) |

**Medicare Assignment:**
| Column | Type | Description |
|--------|------|-------------|
| ind_assgn | VARCHAR | Individual Medicare assignment: Y=Yes, M=May accept |
| grp_assgn | VARCHAR | Group Medicare assignment: Y=Yes, M=May accept |
| adrs_id | VARCHAR | Address identifier (internal CMS ID) |

---

### Common Specialty Values

The most common pri_spec values (use these exact strings in WHERE clauses):
- NURSE PRACTITIONER
- PHYSICIAN ASSISTANT
- INTERNAL MEDICINE
- DIAGNOSTIC RADIOLOGY
- FAMILY PRACTICE
- PHYSICAL THERAPIST IN PRIVATE PRACTICE
- CERTIFIED REGISTERED NURSE ANESTHETIST (CRNA)
- ANESTHESIOLOGY
- CLINICAL SOCIAL WORKER
- EMERGENCY MEDICINE
- CARDIOVASCULAR DISEASE (CARDIOLOGY)
- OBSTETRICS/GYNECOLOGY
- ORTHOPEDIC SURGERY
- OPTOMETRY
- MENTAL HEALTH COUNSELOR
- PSYCHIATRY
- GENERAL SURGERY
- OPHTHALMOLOGY
- DERMATOLOGY
- NEPHROLOGY
- PULMONARY DISEASE
- GASTROENTEROLOGY
- NEUROLOGY
- UROLOGY
- CLINICAL PSYCHOLOGIST

---

### Query Patterns

**Top specialties by clinician count:**
\`\`\`sql
SELECT pri_spec, COUNT(DISTINCT npi) AS clinician_count
FROM dac
GROUP BY pri_spec
ORDER BY clinician_count DESC
LIMIT 20
\`\`\`

**Clinicians by state:**
\`\`\`sql
SELECT state, COUNT(DISTINCT npi) AS clinician_count
FROM dac
WHERE state IS NOT NULL
GROUP BY state
ORDER BY clinician_count DESC
LIMIT 20
\`\`\`

**Specialties in a specific state:**
\`\`\`sql
SELECT pri_spec, COUNT(DISTINCT npi) AS clinician_count
FROM dac
WHERE state = 'CA'
GROUP BY pri_spec
ORDER BY clinician_count DESC
LIMIT 20
\`\`\`

**Gender breakdown by specialty:**
\`\`\`sql
SELECT pri_spec,
  COUNT(DISTINCT CASE WHEN gndr = 'M' THEN npi END) AS male,
  COUNT(DISTINCT CASE WHEN gndr = 'F' THEN npi END) AS female,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN gndr = 'F' THEN npi END) /
    NULLIF(COUNT(DISTINCT npi), 0), 1) AS pct_female
FROM dac
GROUP BY pri_spec
ORDER BY COUNT(DISTINCT npi) DESC
LIMIT 20
\`\`\`

**Telehealth adoption by specialty:**
\`\`\`sql
SELECT pri_spec,
  COUNT(DISTINCT npi) AS total_clinicians,
  COUNT(DISTINCT CASE WHEN telehlth = 'Y' THEN npi END) AS telehealth_clinicians,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN telehlth = 'Y' THEN npi END) /
    NULLIF(COUNT(DISTINCT npi), 0), 1) AS pct_telehealth
FROM dac
GROUP BY pri_spec
ORDER BY total_clinicians DESC
LIMIT 20
\`\`\`

**Look up a specific NPI:**
\`\`\`sql
SELECT npi, provider_first_name, provider_last_name, cred,
  pri_spec, sec_spec_all, facility_name, city, state
FROM dac
WHERE npi = '1234567890'
LIMIT 10
\`\`\`

**Medical schools producing the most clinicians:**
\`\`\`sql
SELECT med_sch, COUNT(DISTINCT npi) AS clinician_count
FROM dac
WHERE med_sch IS NOT NULL AND med_sch != 'OTHER'
GROUP BY med_sch
ORDER BY clinician_count DESC
LIMIT 20
\`\`\`

**Largest group practices:**
\`\`\`sql
SELECT facility_name, org_pac_id, MAX(num_org_mem) AS members,
  COUNT(DISTINCT npi) AS clinicians_in_data,
  state, city
FROM dac
WHERE facility_name IS NOT NULL
GROUP BY facility_name, org_pac_id, state, city
ORDER BY members DESC
LIMIT 20
\`\`\`

---

### Performance Rules (CRITICAL — 2.8M rows)
- ALWAYS use COUNT(DISTINCT npi) to count clinicians, never COUNT(*).
- ALWAYS use GROUP BY to aggregate. Never SELECT * without a WHERE filter on a specific NPI.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- Specialty names are ALL CAPS — use exact strings in WHERE clauses.

### Data Integrity Rules
- NEVER fabricate, hardcode, or invent data values.
- If the question cannot be answered from available columns, return exactly CANNOT_ANSWER: followed by a clear explanation.
- This is a provider directory, not a claims/spending dataset. It has NO payment, billing, or utilization data.
- One NPI can have multiple rows — always use DISTINCT when counting clinicians.

### Important Notes
- This dataset does NOT contain spending, payment, or claims data — only provider demographics and enrollment info.
- Specialty values are uppercase strings (INTERNAL MEDICINE, not Internal Medicine).
- For clinician counts, always use COUNT(DISTINCT npi).
- Gender is coded as M/F (not Male/Female).
- ZIP codes may be 5-digit or 9-digit (use LEFT(zip_code, 5) for 5-digit grouping).
- Some clinicians have no secondary specialty (sec_spec_1 through sec_spec_4 are NULL).
- Only generate SELECT statements. Use DuckDB SQL syntax.
`;
}
