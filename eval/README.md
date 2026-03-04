# Dataset Validation & Evaluation

Validates that Open Health Data Hub produces correct results by comparing query outputs against published statistics from CDC/NCHS.

## Two-Layer Testing

**Layer 1 — SQL Validation**: Gold-standard SQL queries run directly against Railway. Catches data ingestion bugs, weight calculation errors, and column encoding issues.

**Layer 2 — NL-to-SQL Evaluation**: Natural language questions sent to the `/api/query` endpoint. Catches schema prompt issues, NL understanding failures, and SQL generation bugs.

### Diagnosing Failures

| Layer 1 | Layer 2 | Diagnosis |
|---------|---------|-----------|
| PASS | PASS | Everything works |
| PASS | FAIL | Schema prompt or system instructions need fixing |
| FAIL | FAIL | Data ingestion problem — fix data first |
| FAIL | PASS | Unlikely, but NL-to-SQL may use different SQL logic |

## Running

```bash
# Both layers
npx tsx eval/run-eval.ts

# SQL validation only (fast, deterministic)
npx tsx eval/run-eval.ts --layer1-only

# NL-to-SQL only (slower, calls Claude API)
npx tsx eval/run-eval.ts --layer2-only

# Filter by dataset
npx tsx eval/run-eval.ts --dataset brfss
npx tsx eval/run-eval.ts --dataset nhanes

# Verbose output (shows SQL + raw results)
npx tsx eval/run-eval.ts --layer1-only --verbose

# Save results to eval/results/ (gitignored)
npx tsx eval/run-eval.ts --save
```

### Environment

The runner reads `web/.env.local` automatically. Required variables:

- `RAILWAY_QUERY_URL` — Railway service base URL
- `RAILWAY_API_KEY` — Railway bearer token

For Layer 2, the app must be running locally (`npm run dev` in `web/`) or set `APP_BASE_URL` to the deployed URL.

## Adding Test Cases

Edit `eval/ground-truth.ts`. Each test case has:

```typescript
{
  id: "dataset-metric-detail",        // Unique identifier
  dataset: "brfss" | "nhanes",        // Which dataset
  description: "Human-readable name", // What we're testing
  source: "Publication + URL",        // Where the expected value comes from
  sql: "SELECT ...",                   // Gold SQL that should produce the value
  question: "NL question",            // Natural language equivalent
  expected: [{
    column: "result_col",             // Which column to check
    value: 30.9,                      // Expected numeric value
    tolerance: 1.0,                   // Acceptable deviation (±pp)
    filter: { state: "WV" },          // Optional: which row to check
  }]
}
```

### Choosing Tolerances

- **±1.0pp**: Simple weighted prevalences (obesity, smoking) where we expect near-exact match
- **±2.0pp**: State-level estimates or stats with smaller sample sizes
- **±3.0pp**: Complex definitions (diabetes = diagnosed + undiagnosed) where methodology may differ slightly
- **±5.0pp**: Multi-criteria definitions (hypertension = measured BP + self-reported treatment)

## Ground Truth Sources

### BRFSS (7 test cases)

Published by CDC. Self-reported data, phone survey. ~400K respondents/year.

| Source | URL |
|--------|-----|
| CDC Obesity Prevalence Maps | https://www.cdc.gov/obesity/data-and-statistics/adult-obesity-prevalence-maps.html |
| CDC Tobacco Data | https://www.cdc.gov/tobacco/about-data-statistics/index.html |
| CDC Diabetes Surveillance | https://www.cdc.gov/diabetes/php/data-research/index.html |

### NHANES (6 test cases)

Published as NCHS Data Briefs. Clinical measurements (not self-reported). ~12K participants for 2021-2023 cycle.

| Source | URL |
|--------|-----|
| NCHS Data Brief #508 (Obesity) | https://www.cdc.gov/nchs/products/databriefs/db508.htm |
| NCHS Data Brief #511 (Hypertension) | https://www.cdc.gov/nchs/products/databriefs/db511.htm |
| NCHS Data Brief #515 (Cholesterol) | https://www.cdc.gov/nchs/products/databriefs/db515.htm |
| NCHS Data Brief #516 (Diabetes) | https://www.cdc.gov/nchs/products/databriefs/db516.htm |

### Expected BRFSS vs NHANES Differences

BRFSS obesity (~30%) vs NHANES obesity (~40%) is a known ~10pp gap. BRFSS uses self-reported height/weight (people underreport weight, overreport height). NHANES uses measured values. Both are correct for their methodology.
