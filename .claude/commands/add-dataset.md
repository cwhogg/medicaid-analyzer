---
description: "Add a new public health dataset to Open Health Data Hub end-to-end: research, ingest, upload to Railway, create all frontend files, build, and deploy."
---

# Add Dataset — Full Automation

You are adding a new public health dataset to Open Health Data Hub (openhealthdatahub.com). Execute all steps sequentially without pausing for user confirmation. Work autonomously through the full plan. If you encounter an error, attempt to fix it yourself (up to 3 retries with different approaches) before stopping and explaining the blocker.

Run `cd /Users/cwhogg/medicaid-analysis/web && npm run build` after completing each major step to catch regressions early. Do not proceed to the next step if the build is broken — fix it first.

## Arguments

Parse `$ARGUMENTS` for a dataset name and/or URL. Examples:
- `/add-dataset HCUP NIS https://hcup-us.ahrq.gov/nisoverview.jsp`
- `/add-dataset NHIS`
- `/add-dataset` (no args — ask user what dataset to add)

If no arguments are provided, ask the user: "What dataset do you want to add? Provide a name and optionally a URL."

## File Inventory

For every new dataset, you will create or modify these files:

| File | Action | Purpose |
|------|--------|---------|
| `scripts/ingest_<dataset>.py` | **Create** | Download + convert to Parquet |
| `query-service/src/db.ts` | **Modify** | Add view to VIEWS array |
| `web/src/lib/<dataset>Schemas.ts` | **Create** | Schema prompt for Claude NL-to-SQL |
| `web/src/lib/variableMeta.ts` | **Modify** | Add variable groups for Data Dictionary |
| `web/src/lib/datasets/<dataset>.ts` | **Create** | Dataset registration (registerDataset) |
| `web/src/lib/datasets/index.ts` | **Modify** | Add side-effect import |
| `web/src/lib/datasetMeta.ts` | **Modify** | Add homepage card to DATASET_METAS |
| `web/src/app/<slug>/page.tsx` | **Create** | Page route |
| `web/src/components/layout/Footer.tsx` | **Modify** | Add data source link |
| `web/src/app/sitemap.ts` | **Modify** | Add route to sitemap |
| `query-service/src/metrics-db.ts` | **Modify** | Add dataset FILTER to getDailyQueries() |
| `web/src/app/admin/page.tsx` | **Modify** | Add dataset to DaySummary + chart bars |
| `web/src/app/admin/queries/page.tsx` | **Modify** | Add dataset column to daily queries table |
| `web/src/components/landing/Hero.tsx` | **Modify** | Add stat cell to homepage stats row |
| `web/src/app/opengraph-image.tsx` | **Modify** | Add dataset pill + update row count |

**Note:** Navbar does NOT need manual editing — it dynamically renders from DATASET_METAS.

## Naming Conventions

- `<dataset>` — lowercase, no hyphens (e.g., `nhis`, `hcup`, `sdud`)
- `<Dataset>` — PascalCase (e.g., `NHIS`, `HCUP`, `SDUD`)
- `<slug>` — URL path, same as key (e.g., `/nhis`, `/hcup`, `/sdud`)
- `<dataset-key>` — same as `<dataset>` lowercase

## Existing Datasets (do not conflict)

| Dataset | Key | View | Parquet file | Rows | Accent |
|---------|-----|------|-------------|------|--------|
| Medicaid | `medicaid` | `claims` + lookups | `medicaid-provider-spending.parquet` | 227M | `#EA580C` (orange) |
| BRFSS | `brfss` | `brfss` | `brfss_harmonized.parquet` | 4M | `#0EA5E9` (sky blue) |
| Medicare Physician | `medicare` | `medicare` | `medicare_*.parquet` (11 files) | 107M | `#10B981` (emerald) |
| NHANES | `nhanes` | `nhanes` | `nhanes_2021_2023.parquet` | 12K | `#8B5CF6` (purple) |
| Medicare Inpatient | `medicare-inpatient` | `medicare_inpatient` | `inpatient_*.parquet` (11 files) | 2M | `#F59E0B` (amber) |
| DAC (Clinician Directory) | `dac` | `dac` | `dac_clinicians.parquet` | 2.8M | `#EC4899` (pink) |
| Medicare Part D | `medicare-partd` | `medicare_partd` | `partd_*.parquet` (11 files) | 276M | `#14B8A6` (teal) |

---

## Step 0: Gather Information

From `$ARGUMENTS` or user input, determine:
1. **Dataset name** (short identifier)
2. **Source URL** (landing page or direct download)
3. **Source agency** (CMS, CDC, AHRQ, Census, etc.)

If you have a URL, proceed to Step 1. If not, use WebSearch to find the dataset.

---

## Step 1: Research the Dataset

Use WebSearch and WebFetch to evaluate:

1. **Is it freely available?** No registration or DUA required.
2. **Format**: CSV, SAS Transport (.XPT), API, fixed-width?
3. **Size**: How many rows per year? Raw file size?
4. **Granularity**: What does one row represent?
5. **Columns**: How many? Types? Coded values needing labels?
6. **Time dimension**: Monthly, annual, multi-year? What years?
7. **Joins needed**: One flat table or multiple related tables?

**Evaluate fit:**
- Can be expressed as 1-3 DuckDB tables/views
- Has interesting analytical questions users would ask
- Fits on Railway volume (currently ~800MB free of 5GB)
- Complementary to existing datasets
- Estimate Parquet size: typically 5-15x compression vs CSV

Present your findings to the user and confirm before proceeding.

---

## Step 2: Create Ingestion Script

Create `scripts/ingest_<dataset>.py`.

### Template A: CSV/URL Source (like Medicare)

```python
"""
Download <Dataset Name> data and convert to Parquet.

Usage:
    source .venv/bin/activate
    python scripts/ingest_<dataset>.py
"""

import duckdb
import os

# Direct download URL — document where to find a new URL if this breaks
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
                -- Add year column if not present
                2023 AS data_year
            FROM read_csv_auto('{SOURCE_URL}')
        ) TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    """)

    # Verify
    result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUTPUT_FILE}')").fetchone()
    print(f"Rows: {result[0]:,}")

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

### Template B: SAS/Multi-file Source (like NHANES)

```python
"""
Download <Dataset Name> data files and merge into a single Parquet.

Usage:
    source .venv/bin/activate
    python scripts/ingest_<dataset>.py
"""

import pandas as pd
import duckdb
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "<dataset>.parquet")

# Component files to download and merge
COMPONENTS = [
    ("demographics", "https://...DEMO.XPT"),
    ("labs", "https://...LAB.XPT"),
]

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    frames = {}
    for name, url in COMPONENTS:
        print(f"Downloading {name}...")
        df = pd.read_sas(url)
        frames[name] = df
        print(f"  {len(df):,} rows, {len(df.columns)} columns")

    # Merge on shared key
    merged = frames["demographics"]
    for name, df in frames.items():
        if name == "demographics":
            continue
        merged = merged.merge(df, on="SEQN", how="left")

    print(f"\nMerged: {len(merged):,} rows, {len(merged.columns)} columns")

    # Write to Parquet via DuckDB
    con = duckdb.connect()
    con.register("merged_df", merged)
    con.execute(f"""
        COPY (SELECT * FROM merged_df)
        TO '{OUTPUT_FILE}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    """)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"Output: {size_mb:.1f} MB")
    con.close()

if __name__ == "__main__":
    main()
```

### Data normalization rules:
- **Identifiers must be VARCHAR**: NPI, FIPS, ZIP, procedure codes — always cast. Leading zeros matter.
- **Use snappy compression**: Always `COMPRESSION SNAPPY`.
- **Add a year/period column** if not already present.
- **Keep all columns** unless extremely wide (100+). For wide datasets, select the most useful 80-100 columns.

---

## Step 3: Run Ingestion

```bash
cd /Users/cwhogg/medicaid-analysis && source .venv/bin/activate && python scripts/ingest_<dataset>.py
```

Verify:
- Row count matches expectations
- Column types correct (identifiers as VARCHAR)
- File size is reasonable (will fit on Railway volume)
- Sample data looks correct (`DESCRIBE` and `SELECT * LIMIT 5`)

---

## Step 4: Upload to Railway

### Method A: Public URL + httpfs (preferred if data has a direct download URL)

The Railway service has `duckdb-async` installed as a Node.js module. SSH in and use DuckDB's httpfs to stream directly from the source URL:

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

### Method B: Local Parquet via ngrok + httpfs (when file was generated locally)

Use this when the Parquet was generated by a local Python script and can't be produced from a public URL on Railway.

**Prerequisites:** `brew install ngrok`, set up auth token at ngrok.com.

1. **Start temporary HTTP server** in the data directory:
   ```bash
   cd /Users/cwhogg/medicaid-analysis/data && python3 -m http.server 8765 &
   ```

2. **Start ngrok tunnel:**
   ```bash
   ngrok http 8765 --log=stdout --log-format=json &
   sleep 5
   NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])")
   echo "ngrok URL: $NGROK_URL"
   ```

3. **SSH into Railway and download via DuckDB httpfs:**
   ```bash
   railway ssh -- "node -e \"
   const { Database } = require('duckdb-async');
   (async () => {
     const db = await Database.create(':memory:');
     await db.run('INSTALL httpfs; LOAD httpfs;');
     console.log('Downloading...');
     await db.run('COPY (SELECT * FROM read_parquet(\\\"$NGROK_URL/<filename>.parquet\\\")) TO \\\"/data/<filename>.parquet\\\" (FORMAT PARQUET, COMPRESSION SNAPPY)');
     const result = await db.all('SELECT COUNT(*) as cnt FROM read_parquet(\\\"/data/<filename>.parquet\\\")');
     console.log('Done! Rows:', result[0].cnt);
     await db.close();
   })().catch(e => { console.error(e); process.exit(1); });
   \""
   ```

4. **Clean up** — kill ngrok and HTTP server when done.

**Critical notes:**
- `railway ssh` does NOT support stdin piping for binary data — files arrive as 0 bytes.
- Always use the DuckDB httpfs method instead.
- Keep ngrok updated (`ngrok update`).

---

## Step 5: Register View in query-service

Edit `query-service/src/db.ts` — add to the `VIEWS` array:

```typescript
["<view_name>", "<filename>.parquet"],
```

Then deploy and restart:

```bash
cd /Users/cwhogg/medicaid-analysis/query-service && railway up --detach
```

Wait ~60s for build, then:

```bash
railway restart --yes
```

Verify the view loaded:
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

Check volume space: `railway volume list` (5GB limit).

---

## Step 6: Create Schema Prompt

Create `web/src/lib/<dataset>Schemas.ts`.

This is the **most important file** — it teaches Claude how to write SQL for this dataset. Follow this template (modeled on `medicareSchemas.ts`):

```typescript
export function generate<Dataset>SchemaPrompt(): string {
  return `## <Dataset Full Name> — <Year(s)>

You have ONE table: **<view_name>** (~<N> rows, <M> columns)

<1-2 sentence description of what this dataset is and what each row represents.>

---

### CRITICAL: <Domain-Specific Calculation Pattern>

<Explain the key calculation pattern users will need. Examples:
- Medicare: "All payment columns are averages per service. Multiply by Tot_Srvcs for totals."
- BRFSS: "Always use _LLCPWT survey weight for population estimates."
- Show 2-3 SQL snippets demonstrating the correct pattern.>

---

### Columns

<Group columns by category using markdown tables:>

**Category Name:**
| Column | Type | Description |
|--------|------|-------------|
| col1 | VARCHAR | Description here |

<Repeat for each category: Identity, Location, Service, Volume/Payment, Demographics, etc.>

---

### Query Patterns

<5-8 complete SQL examples covering common question types:>

**<Pattern description>:**
\\\`\\\`\\\`sql
SELECT ...
FROM <view_name>
WHERE ...
GROUP BY ...
ORDER BY ... DESC
LIMIT 20
\\\`\\\`\\\`

---

### Performance Rules (CRITICAL — <N> rows)
- ALWAYS use GROUP BY to aggregate. Never SELECT * without aggregation.
- ALWAYS include a LIMIT clause (max 10000 rows).
- For "top N" queries, use ORDER BY ... DESC LIMIT N.
- Avoid subqueries when a single GROUP BY suffices.

### Data Integrity Rules
- NEVER fabricate, hardcode, or invent data values.
- If the question cannot be answered, respond with CANNOT_ANSWER: followed by a clear explanation.
- <Dataset-specific integrity rules>

### Important Notes
- <Domain-specific gotchas>
- <What's NOT in this dataset>
- Only generate SELECT statements. Use DuckDB SQL syntax.
- Round dollar amounts with ROUND(..., 0).
`;
}
```

**Key principles:**
- Document EVERY column with name, type, and description
- Document ALL coded values (1=Yes, 2=No, etc.)
- Show correct calculation patterns with SQL snippets
- Include 5-8 complete query examples
- Document what's NOT in the dataset
- Include performance rules appropriate to the table size

---

## Step 7: Add Variable Metadata

Edit `web/src/lib/variableMeta.ts`.

Add a new export following this pattern:

```typescript
export const <dataset>VariableGroups: VariableGroup[] = [
  {
    name: "Group Name",
    description: "Brief description of this category",
    variables: [
      {
        name: "column_name",
        type: "VARCHAR",
        description: "Human-readable description",
        codes: "1=Yes, 2=No",           // optional — for coded values
        note: "2023 only",              // optional — availability note
      },
    ],
  },
];
```

Group variables by topic (Demographics, Clinical, Payment, etc.). Include all columns from the dataset.

---

## Step 8: Create Dataset Registration

Create `web/src/lib/datasets/<dataset>.ts`.

This is the central config that ties everything together. Use this template:

```typescript
import { registerDataset } from "@/lib/datasets";
import { generate<Dataset>SchemaPrompt } from "@/lib/<dataset>Schemas";
import { <dataset>VariableGroups } from "@/lib/variableMeta";

// If the dataset has a time dimension:
// const <DATASET>_YEARS = [2024, 2023, 2022, ...];
// function buildYearConstraint(years: number[]): string {
//   if (years.length === 1) {
//     return `\n\nIMPORTANT: The user has selected year ${years[0]}. You MUST add WHERE <date_col> = ${years[0]}.`;
//   }
//   return `\n\nIMPORTANT: The user has selected years ${years.join(", ")}. You MUST add WHERE <date_col> IN (${years.join(", ")}).`;
// }

registerDataset({
  // Identity
  key: "<dataset-key>",
  label: "<Dataset Label>",
  beta: true,

  // Backend — which Railway service to query
  envUrlKey: "RAILWAY_QUERY_URL",
  envApiKeyKey: "RAILWAY_API_KEY",

  // Claude prompts
  generateSchemaPrompt: generate<Dataset>SchemaPrompt,
  systemPromptPreamble: "You are a SQL expert that translates natural language questions into DuckDB SQL queries for <describe dataset in one sentence>.",
  systemPromptRules: `Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- EXCEPTION: If the question cannot be answered from available columns, return exactly: CANNOT_ANSWER: followed by a clear explanation.
- Always include a LIMIT clause (max 10000) unless the query is a single aggregated row.
- Only use SELECT statements. Use DuckDB SQL syntax.
- <Dataset-specific rules — calculation patterns, coded values, weight usage, etc.>
- Provide readable labels via CASE WHEN for coded values — never return raw numeric codes.`,
  retrySystemPromptRules: `Rules:
- Return ONLY the SQL query. No markdown.
- Always include LIMIT (max 10000). Only SELECT. DuckDB SQL.
- <Simplified version of key rules>`,

  // Page UI text
  pageTitle: "Analyze <Topic>",
  pageSubtitle: "Ask questions about <topic> in natural language",
  inputHeading: "Ask a question about <topic>",
  inputPlaceholder: "Example question here?",

  // Year filtering — null if single year or no time dimension
  yearFilter: null,
  // yearFilter: { years: <DATASET>_YEARS, dateColumn: "<date_col>" },
  // buildYearConstraint,

  // Deep analysis
  deepAnalysisSupported: true,

  // Scope checking — reject obviously out-of-scope questions before calling Claude
  checkDataScope: (question: string) => {
    const q = question.toLowerCase();
    const outOfScope = [
      { patterns: ["<irrelevant_topic>"], reason: "This dataset doesn't cover <topic>. Try the <other> dataset." },
    ];
    for (const { patterns, reason } of outOfScope) {
      if (patterns.some((p) => q.includes(p))) return reason;
    }
    return null;
  },

  // Result caveat shown above results
  resultCaveat: {
    title: "<Dataset> data (<year>)",
    text: "Brief caveat about data limitations.",
    borderColor: "border-<color>-500/30",  // unique color
    titleColor: "text-<color>-300",
  },

  // Example query chips (3-5)
  exampleQueries: [
    { label: "Short label", question: "Full question text?" },
    { label: "Short label", question: "Full question text?" },
    { label: "Short label", question: "Full question text?" },
  ],

  // Data dictionary
  variableGroups: <dataset>VariableGroups,

  // Domain knowledge for deep analysis
  domainKnowledge: `## <Dataset> Domain Knowledge
- Key fact about the dataset
- What each row represents
- Time coverage and limitations
- Important caveats for interpretation
- What's NOT in this dataset`,
});
```

---

## Step 9: Register in Dataset Index

Edit `web/src/lib/datasets/index.ts` — add the side-effect import:

```typescript
import "./<dataset>";
```

---

## Step 10: Add Homepage Card

Edit `web/src/lib/datasetMeta.ts`:

1. Add the appropriate lucide-react icon import at the top
2. Add to `DATASET_METAS` array (before any `comingSoon` entries):

```typescript
{
  key: "<dataset-key>",
  title: "<Display Title>",
  subtitle: "<Short Tagline>",
  icon: <LucideIcon>,
  stats: [
    { label: "Rows", value: "~<N>" },
    { label: "Year", value: "<year(s)>" },
  ],
  description: "<2-3 sentence description of what users can analyze.>",
  limitations: [
    "Limitation 1",
    "Limitation 2",
  ],
  href: "/<slug>",
  accentColor: "<pick from available colors>",
},
```

---

## Step 11: Create Page Route

Create `web/src/app/<slug>/page.tsx`:

```typescript
import DatasetAnalyzePage from "@/components/analyze/DatasetAnalyzePage";

export default function <Dataset>Page() {
  return <DatasetAnalyzePage datasetKey="<dataset-key>" />;
}
```

---

## Step 12: Add Footer Source Link

Edit `web/src/components/layout/Footer.tsx` — add a `<p>` tag in the right-side `<div>` (the one with `text-sm text-muted-dark text-right space-y-1`):

```tsx
<p>
  <a href="<canonical_dataset_url>" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors"><Agency> <Dataset Name></a> (<years>). <N>+ records.
</p>
```

---

## Step 13: Add Sitemap Route

Edit `web/src/app/sitemap.ts` — add to `staticRoutes` array:

```typescript
{
  url: `${BASE_URL}/<slug>`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.9,
},
```

---

## Step 14: Homepage Stats Row

Edit `web/src/components/landing/Hero.tsx` — add a new stat cell to the stats grid.

The grid uses `grid-cols-2 sm:grid-cols-N` where N is the number of datasets. Add a new `<div className="stat-cell">` with the dataset's headline stat (row count), label, and date range. Follow the existing pattern:

```tsx
<div className="stat-cell">
  <div className="font-headline text-[1.75rem] sm:text-[2.375rem] font-bold text-foreground leading-[1.1] tracking-tight"><N></div>
  <div className="text-[0.8125rem] font-semibold tracking-[0.04em] uppercase text-body mt-1"><Label></div>
  <div className="text-[0.6875rem] text-muted mt-0.5 tracking-wide"><Source> <Years></div>
</div>
```

Update the grid column count: `sm:grid-cols-N` where N = total number of stat cells. If adding a cell pushes beyond the current max-width, increase `max-w-[...]` proportionally (~190px per column).

The last stat cell should have `border-r-0` to remove the right border.

---

## Step 15: Update OpenGraph Image

Edit `web/src/app/opengraph-image.tsx`:

1. Add the new dataset to the `datasets` array with a short label and the dataset's accent color:
   ```typescript
   { name: "<Short Label>", color: "<accentColor>" },
   ```
2. Update the subtitle row count (`"Explore <N>M+ rows..."`) to include the new dataset's rows.
3. Add the new accent color to the bottom gradient `background` string.

---

## Step 16: Admin Analytics

Update the admin dashboard to track queries for the new dataset.

### 16a. Backend — `query-service/src/metrics-db.ts`

In the `getDailyQueries()` function, find the SQL query that aggregates per-dataset counts. Add a new FILTER line and a new field in the return mapping:

```sql
COUNT(*) FILTER (WHERE dataset = '<dataset-key>') as <dataset_key_underscored>
```

And in the return `rows.map(...)` (use the dataset key as the JSON property name, quoted if it contains hyphens):
```typescript
"<dataset-key>": Number(r.<dataset_key_underscored>),
```

### 16b. Frontend — `web/src/app/admin/page.tsx`

1. Add the new field to the `DaySummary` interface:
   ```typescript
   "<dataset-key>": number;
   ```

2. Add the dataset to the `DATASET_OPTIONS` array (used for blog pipeline dataset filtering, color coding, and labels):
   ```typescript
   { key: "<dataset-key>", label: "<Dataset Label>", color: "<accentColor>" },
   ```

3. Add a new `<Bar>` in the "Queries by Day" stacked chart (use the dataset's accent color). Change the previous last Bar's radius to `[0, 0, 0, 0]`, then add yours as the new last:
   ```tsx
   <Bar
     dataKey="<dataset-key>"
     name="<Dataset Label>"
     stackId="queries"
     fill="<accentColor>"
     radius={[2, 2, 0, 0]}
     maxBarSize={40}
   />
   ```
   The **last** Bar in the stack should have `radius={[2, 2, 0, 0]}` for rounded top corners.

### 16c. Frontend — `web/src/app/admin/queries/page.tsx`

1. Add the new field to the `DaySummary` interface.
2. Add a color-coded `<th>` header and a `<td>` cell showing `{d.<dataset_key> || 0}` in the daily summary table.

---

## Step 17: Build

```bash
cd /Users/cwhogg/medicaid-analysis/web && npm run build
```

If build fails, fix the error and retry (up to 3 times with different approaches). Common issues:
- Import path typos
- Missing exports
- TypeScript type mismatches with `DatasetConfig` interface
- SSR issues (should not occur since no DuckDB-WASM is involved)

---

## Step 18: Deploy

Commit all changes, push, and deploy:

```bash
cd /Users/cwhogg/medicaid-analysis
git add scripts/ingest_<dataset>.py web/src/lib/<dataset>Schemas.ts web/src/lib/variableMeta.ts web/src/lib/datasets/<dataset>.ts web/src/lib/datasets/index.ts web/src/lib/datasetMeta.ts web/src/app/<slug>/page.tsx web/src/components/layout/Footer.tsx web/src/app/sitemap.ts query-service/src/db.ts query-service/src/metrics-db.ts web/src/app/admin/page.tsx web/src/app/admin/queries/page.tsx web/src/components/landing/Hero.tsx web/src/app/opengraph-image.tsx
git commit -m "Add <Dataset Name> dataset (<year>, ~<N> rows)"
git push origin main
vercel --prod --yes
```

---

## Troubleshooting

### Railway SSH doesn't pipe binary data
`railway ssh` ignores stdin. Files piped via `cat file | railway ssh -- "cat > /path"` arrive as 0 bytes. Use the DuckDB httpfs method (Step 4) instead.

### DuckDB can't read .XPT (SAS Transport) files
DuckDB doesn't support SAS format natively. Convert locally with Python (`pandas.read_sas()` -> write Parquet), then upload via ngrok method (Step 4 Method B).

### Railway volume is full
Run `railway volume list` to check (5GB limit). Options:
- Remove unused files: `railway ssh -- "rm /data/old_file.parquet"`
- Request volume resize in Railway dashboard
- Use more aggressive column selection or compression

### Claude generates bad SQL for the new dataset
The schema prompt (Step 6) is almost always the fix:
- Missing column descriptions -> Claude guesses wrong column names
- Missing query examples -> Claude uses wrong patterns
- Missing domain gotchas -> Claude makes calculation errors
- Iterate on the schema prompt, test with `npm run dev`, repeat

### Build fails with "Cannot find module"
Check import paths — ensure the schema file and variable meta exports match exactly what the dataset registration file imports.
