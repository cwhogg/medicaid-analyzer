# Adding a New Dataset to Open Health Data Hub

This is the complete, step-by-step guide for adding a new public health dataset to the platform. Follow every step in order.

---

## Phase 1: Research & Evaluate the Dataset

Before writing any code, answer these questions:

### 1.1 Find the data source
- Is it a US federal/public health dataset? (CMS, CDC, HHS, Census, etc.)
- Is it freely available with no registration or DUA required?
- What's the canonical URL for the dataset landing page?

### 1.2 Understand the structure
- **Format**: CSV, SAS Transport (.XPT), API, fixed-width, etc.?
- **Size**: How many rows per year? How large are the raw files?
- **Granularity**: What does one row represent? (one claim, one survey respondent, one provider+procedure, etc.)
- **Columns**: How many? What types? Are there coded values that need labels?
- **Time dimension**: Monthly, annual, multi-year cycle? What years are available?
- **Joins needed**: Is it one flat table or multiple related tables?

### 1.3 Evaluate fit
Good datasets for this platform:
- Can be expressed as 1-3 DuckDB tables/views
- Have interesting analytical questions users would ask
- Fit on the Railway volume (currently ~800MB free of 5GB)
- Are complementary to existing datasets (Medicaid, Medicare, BRFSS)

Estimate Parquet size: typically 5-15x compression vs CSV. A 3GB CSV becomes ~400-600MB Parquet.

---

## Phase 2: Data Ingestion

### 2.1 Create an ingestion script

Create `scripts/ingest_<dataset>.py` in the repo root.

**Pattern** (adapt to your data source):

```python
"""
Download <Dataset Name> data and convert to Parquet.

Usage:
    source .venv/bin/activate
    python scripts/ingest_<dataset>.py
"""

import duckdb
import os

# Direct download URL for the source data
# IMPORTANT: Document where to find a new URL if this one breaks
SOURCE_URL = "https://..."

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "<dataset>_<year>.parquet")

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    con = duckdb.connect()

    print("Converting to Parquet...")
    con.execute(f"""
        COPY (
            SELECT
                -- Cast identifier columns to VARCHAR (NPIs, codes, FIPS, etc.)
                CAST(some_id AS VARCHAR) AS some_id,
                -- Include all other columns
                col1, col2, col3,
                -- Add year column if not present in source
                2023 AS data_year
            FROM read_csv_auto('{SOURCE_URL}')
        ) TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    """)

    # Verify
    result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUTPUT_FILE}')").fetchone()
    print(f"Rows: {result[0]:,}")

    # Show columns and types
    cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{OUTPUT_FILE}')").fetchall()
    print(f"\nColumns ({len(cols)}):")
    for col in cols:
        print(f"  {col[0]:40s} {col[1]}")

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"\nSize: {size_mb:.1f} MB")
    con.close()

if __name__ == "__main__":
    main()
```

### 2.2 Data normalization rules

- **Identifiers must be VARCHAR**: NPI numbers, FIPS codes, ZIP codes, procedure codes — always cast to VARCHAR even if they look numeric. Leading zeros matter.
- **Use snappy compression**: Always `COMPRESSION SNAPPY` for Parquet output.
- **Add a year/period column** if not already present in the data.
- **Keep all columns** unless the dataset is extremely wide (100+). For wide datasets (like NHANES), select the most useful 80-100 columns.
- **For SAS Transport (.XPT) files**: Use `pandas.read_sas(url)` to download and parse, merge on a key column (e.g., SEQN for NHANES), then write to Parquet.
- **For multi-file datasets**: Merge/join all component files in the script, output a single Parquet.

### 2.3 Verify before proceeding

Run the script locally and confirm:
- [ ] Row count matches expectations
- [ ] Column types are correct (especially identifiers as VARCHAR)
- [ ] File size is reasonable (will fit on Railway volume)
- [ ] Sample data looks correct

---

## Phase 3: Upload Data to Railway

### 3.1 Register the view

Edit `query-service/src/db.ts` and add to the `VIEWS` array:

```typescript
["<view_name>", "<filename>.parquet"],
```

The view name is what SQL queries will reference (e.g., `SELECT * FROM medicare`).

### 3.2 Deploy updated query-service

```bash
cd query-service && railway up --detach
```

Wait for the build to complete (~60s).

### 3.3 Upload Parquet to Railway volume via DuckDB httpfs

**This is the key technique.** SSH into the Railway service and use DuckDB's httpfs extension to stream the source data directly from its URL and write Parquet to the volume — no local file transfer needed.

```bash
railway ssh -- "node -e \"
const { Database } = require('duckdb-async');
(async () => {
  const db = await Database.create(':memory:');
  await db.run('INSTALL httpfs; LOAD httpfs;');
  console.log('httpfs loaded, starting download + conversion...');
  await db.run(\\\`
    COPY (
      SELECT
        CAST(some_id AS VARCHAR) AS some_id,
        col1, col2, col3,
        2023 AS data_year
      FROM read_csv_auto('https://source-url-here/data.csv')
    ) TO '/data/<filename>.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY)
  \\\`);
  const result = await db.all('SELECT COUNT(*) as cnt FROM read_parquet(\\'/data/<filename>.parquet\\')');
  console.log('Done! Rows:', result[0].cnt);
  await db.close();
})().catch(e => { console.error(e); process.exit(1); });
\""
```

**Important notes:**
- The Railway service has `duckdb-async` installed (Node.js module) — use that, not Python.
- `railway ssh` does NOT support stdin piping for binary data. Don't try `cat file | railway ssh -- "cat > /data/file"` — it writes 0 bytes.
- If curl is needed on the service: `railway ssh -- "apt-get update && apt-get install -y curl"`
- For SAS Transport (.XPT) files that DuckDB can't read natively, you'll need to convert locally first and find an alternative upload method (temporary HTTP hosting, or pre-convert to CSV and host the CSV).

### 3.4 Restart the service

```bash
railway restart --yes
```

### 3.5 Verify views loaded

```bash
railway ssh -- "node -e \"
const { Database } = require('duckdb-async');
(async () => {
  const db = await Database.create(':memory:');
  await db.run('CREATE VIEW <name> AS SELECT * FROM read_parquet(\\'/data/<file>.parquet\\')');
  const r = await db.all('SELECT COUNT(*) as cnt FROM <name>');
  console.log('Rows:', r[0].cnt);
  await db.close();
})();
\""
```

### 3.6 Check volume space

```bash
railway volume list
```

Current limit is 5GB. Check remaining space before uploading large files.

---

## Phase 4: Frontend — Schema Prompt

Create `web/src/lib/<dataset>Schemas.ts`.

This is the most important file — it's the system prompt that teaches Claude how to write SQL for this dataset. Study the existing examples:
- `web/src/lib/schemas.ts` (Medicaid — complex, multiple JOIN tables)
- `web/src/lib/brfssSchemas.ts` (BRFSS — single wide table, survey weights)
- `web/src/lib/medicareSchemas.ts` (Medicare — single table, avg-per-service payment math)

### Schema prompt must include:

1. **Table name(s)** and row counts
2. **Every column** with name, type, and description
3. **Coded values** — if a column uses numeric codes (1=Yes, 2=No), document them all
4. **Payment/calculation patterns** — show how to compute totals, rates, prevalences
5. **3-5 SQL query examples** covering the most common question types
6. **Performance rules** — always GROUP BY, always LIMIT, etc.
7. **Data integrity rules** — never fabricate data, use CANNOT_ANSWER for out-of-scope
8. **Domain-specific gotchas** — things that commonly trip up SQL generation (e.g., "averages not totals", "survey weights required", "beneficiaries can't be summed across codes")

Export a function: `export function generate<Dataset>SchemaPrompt(): string { return \`...\`; }`

---

## Phase 5: Frontend — Variable Metadata

Edit `web/src/lib/variableMeta.ts`.

Add a new export: `export const <dataset>VariableGroups: VariableGroup[]`

This powers the Data Dictionary tab on the dataset page. Group variables by topic:

```typescript
export const myDatasetVariableGroups: VariableGroup[] = [
  {
    name: "Group Name",
    description: "Brief description of this category",
    variables: [
      {
        name: "column_name",
        type: "VARCHAR",
        description: "Human-readable description",
        codes: "1=Yes, 2=No",           // optional
        note: "2023 only",              // optional availability note
      },
    ],
  },
];
```

---

## Phase 6: Frontend — Dataset Registration

Create `web/src/lib/datasets/<dataset>.ts`.

This is the central configuration that ties everything together. Use existing files as templates:
- `web/src/lib/datasets/medicaid.ts`
- `web/src/lib/datasets/brfss.ts`
- `web/src/lib/datasets/medicare.ts`

### Required fields:

```typescript
import { registerDataset } from "@/lib/datasets";
import { generate<Dataset>SchemaPrompt } from "@/lib/<dataset>Schemas";
import { <dataset>VariableGroups } from "@/lib/variableMeta";

registerDataset({
  // Identity
  key: "<dataset-key>",        // URL-safe, used in API calls
  label: "<Dataset Name>",     // Display name
  beta: true,                  // Start as beta, remove when stable

  // Backend — which Railway service to query
  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  // Claude prompts
  generateSchemaPrompt: generate<Dataset>SchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL queries for <dataset description>.",
  systemPromptRules: `Rules:\n- Return ONLY the SQL query...\n- ...`,
  retrySystemPromptRules: `Simplified rules for retry...`,

  // Page UI text
  pageTitle: "Analyze <Topic>",
  pageSubtitle: "Ask questions about <dataset> in natural language",
  inputHeading: "Ask a question about <topic>",
  inputPlaceholder: "Example question here?",

  // Year filtering (null if single year or no time dimension)
  yearFilter: null,  // or { years: [2023, 2022, ...], dateColumn: "year_col" }
  buildYearConstraint: undefined,  // function to inject WHERE clause

  // Deep analysis
  deepAnalysisSupported: true,

  // Scope checking — reject obviously out-of-scope questions before calling Claude
  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    // Return error string for out-of-scope, null for valid
    if (q.includes("something_impossible")) return "This dataset doesn't contain X.";
    return null;
  },

  // Result caveat shown above results
  resultCaveat: {
    title: "<Dataset> data (<year>)",
    text: "Brief caveat about data limitations.",
    borderColor: "border-emerald-500/30",  // pick a unique color
    titleColor: "text-emerald-300",
  },

  // Example query chips (3-5)
  exampleQueries: [
    { label: "Short label", question: "Full question text?" },
  ],

  // Data dictionary
  variableGroups: <dataset>VariableGroups,

  // Domain knowledge for deep analysis
  domainKnowledge: `## <Dataset> Domain Knowledge\n- Key fact 1\n- Key fact 2\n...`,
});
```

### Register in the index

Edit `web/src/lib/datasets/index.ts`:

```typescript
import "./<dataset>";  // Add this line
```

---

## Phase 7: Frontend — Homepage Card, Page Route, Navbar

### 7.1 Homepage card

Edit `web/src/lib/datasetMeta.ts`:

```typescript
import { SomeIcon } from "lucide-react";

// Add to DATASET_METAS array (before any comingSoon entries):
{
  key: "<dataset-key>",
  title: "Display Title",
  subtitle: "Short tagline",
  icon: SomeIcon,
  stats: [
    { label: "Rows", value: "~9.7M" },
    { label: "Year", value: "2023" },
  ],
  description: "2-3 sentence description of what users can do.",
  limitations: [
    "Limitation 1",
    "Limitation 2",
  ],
  href: "/<dataset-slug>",
  accentColor: "#10B981",  // Pick a unique color (not #EA580C orange or #0EA5E9 blue)
},
```

### 7.2 Page route

Create `web/src/app/<dataset-slug>/page.tsx`:

```typescript
import DatasetAnalyzePage from "@/components/analyze/DatasetAnalyzePage";

export default function DatasetPage() {
  return <DatasetAnalyzePage datasetKey="<dataset-key>" />;
}
```

### 7.3 Navbar link

Edit `web/src/components/layout/Navbar.tsx` — add a link in BOTH the desktop nav section AND the mobile menu section. Follow the existing pattern (search for "Medicaid" or "BRFSS" links).

### 7.4 Footer source link

Edit `web/src/components/layout/Footer.tsx` — add a data source link in the right-side `<div>`.

### 7.5 Sitemap

Edit `web/src/app/sitemap.ts` — add the new route to `staticRoutes`.

---

## Phase 8: Build, Test, Deploy

### 8.1 Build

```bash
cd web && npm run build
```

Fix any errors before proceeding.

### 8.2 Test locally

```bash
cd web && npm run dev
```

Verify:
- [ ] Homepage shows new dataset card
- [ ] Clicking card navigates to `/<dataset-slug>`
- [ ] Year filter chips appear (if applicable)
- [ ] Example query chips appear
- [ ] Data Dictionary tab shows variable groups
- [ ] Typing a question and submitting returns results

### 8.3 Commit and push

```bash
git add <all new/modified files>
git commit -m "Add <Dataset Name> dataset (<year>, <row count> rows)"
git push origin main
```

### 8.4 Deploy to Vercel

```bash
cd /Users/cwhogg/medicaid-analysis && vercel --prod --yes
```

### 8.5 Verify production

Visit `https://www.openhealthdatahub.com/<dataset-slug>` and run an example query end-to-end.

---

## File Checklist

For every new dataset, you will create or modify these files:

| File | Action | Purpose |
|------|--------|---------|
| `scripts/ingest_<dataset>.py` | **Create** | Download + convert to Parquet |
| `query-service/src/db.ts` | **Modify** | Add view to VIEWS array |
| `web/src/lib/<dataset>Schemas.ts` | **Create** | Schema prompt for Claude |
| `web/src/lib/variableMeta.ts` | **Modify** | Add variable groups for Data Dictionary |
| `web/src/lib/datasets/<dataset>.ts` | **Create** | Dataset registration (registerDataset) |
| `web/src/lib/datasets/index.ts` | **Modify** | Add side-effect import |
| `web/src/lib/datasetMeta.ts` | **Modify** | Add homepage card |
| `web/src/app/<slug>/page.tsx` | **Create** | Page route |
| `web/src/components/layout/Navbar.tsx` | **Modify** | Add nav link (desktop + mobile) |
| `web/src/components/layout/Footer.tsx` | **Modify** | Add data source link |
| `web/src/app/sitemap.ts` | **Modify** | Add route to sitemap |

---

## Existing Datasets Reference

| Dataset | Key | View name | Parquet file | Rows | Accent color |
|---------|-----|-----------|-------------|------|-------------|
| Medicaid | `medicaid` | `claims` + lookups | `medicaid-provider-spending.parquet` | 227M | `#EA580C` (orange) |
| BRFSS | `brfss` | `brfss` | `brfss_harmonized.parquet` | 3.5M | `#0EA5E9` (sky blue) |
| Medicare | `medicare` | `medicare` | `medicare_physician_2023.parquet` | 9.7M | `#10B981` (emerald) |

Available accent colors (not yet used): `#8B5CF6` (purple), `#F59E0B` (amber), `#EC4899` (pink), `#14B8A6` (teal).

---

## Troubleshooting

### Railway SSH doesn't pipe binary data
`railway ssh` ignores stdin. Files piped via `cat file | railway ssh -- "cat > /path"` arrive as 0 bytes. Use the DuckDB httpfs method described in Phase 3.3 instead.

### DuckDB can't read .XPT (SAS Transport) files
DuckDB doesn't support SAS format natively. Options:
1. Convert locally with Python (`pandas.read_sas()` → write CSV/Parquet), then host the converted file at a URL for Railway to download.
2. If the source agency provides CSV downloads, prefer those.

### Railway volume is full
Run `railway volume list` to check. Current limit is 5GB. Options:
- Remove unused Parquet files: `railway ssh -- "rm /data/old_file.parquet"`
- Request volume resize in Railway dashboard
- Use more aggressive Parquet compression or drop unnecessary columns

### Claude generates bad SQL for the new dataset
The schema prompt (Phase 4) is almost always the fix. Common issues:
- Missing column descriptions → Claude guesses wrong column names
- Missing query examples → Claude uses wrong patterns
- Missing gotcha documentation → Claude makes domain errors (e.g., summing averages instead of multiplying)
- Iterate on the schema prompt, test with `npm run dev`, repeat.
