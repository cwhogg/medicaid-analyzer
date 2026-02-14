# Medicaid Data Analyzer — Claude Code Project

## Project Overview

Build a product marketing site + natural language query interface for a 227M-row Medicaid provider spending dataset (2.9GB Parquet, Jan 2018–Dec 2024). Deploy on Vercel with a dark theme matching nofone.us.

## Critical Architecture

**DuckDB-WASM runs in the browser, NOT on the server.** The duckdb Node.js package (~284MB) exceeds Vercel's 250MB serverless function limit. The architecture is:

- DuckDB-WASM executes SQL client-side in the browser
- The only API route (`/api/query`) calls Claude to generate SQL — it is lightweight (~100KB)
- Pre-aggregated Parquet files are served as static assets from `public/data/`
- The server never touches DuckDB

This is non-negotiable. Do not attempt to run DuckDB server-side.

## Execution Mode

Execute all steps sequentially without pausing for user confirmation. Work autonomously through the full plan. If you encounter an error, attempt to fix it yourself (up to 3 retries with different approaches) before stopping and explaining the blocker.

Run `npm run build` after completing each major step to catch regressions early. Do not proceed to the next step if the build is broken — fix it first.

## Tech Stack (locked — do not change)

- **Framework**: Next.js 14 (App Router) on Vercel
- **Styling**: Tailwind CSS — dark theme (#0A0A0A bg, #EA580C orange accent)
- **Fonts**: Outfit (headings/body) + JetBrains Mono (data/code)
- **Query engine**: @duckdb/duckdb-wasm — client-side SQL execution
- **NL-to-SQL**: @anthropic-ai/sdk — Claude Sonnet, temperature 0
- **Charts**: Recharts
- **Icons**: lucide-react
- **Utilities**: clsx, tailwind-merge

## Pre-Aggregated Data Tables

The raw 2.9GB file gets pre-aggregated into 5 Parquet files + 3 JSON files:

| Table | ~Rows | ~Size | Purpose |
|---|---|---|---|
| monthly_totals | 84 | <5KB | Overall spending trends |
| hcpcs_summary | ~10.9K | ~300KB | Procedure code aggregates |
| hcpcs_monthly | ~900K | ~8MB | Procedure trends over time |
| provider_summary | ~617K | ~35MB | Provider-level aggregates |
| top_providers_monthly | ~84K | ~5MB | Monthly detail for top 1K providers |

Static JSON: `stats.json`, `monthly_trend.json`, `top_providers.json` (for landing page).

## File Structure

```
medicaid-analysis/
  scripts/
    aggregate.py              # Pre-aggregation (run locally with existing .venv)
  web/
    src/
      app/
        layout.tsx            # Root layout, fonts, metadata
        page.tsx              # Marketing landing page
        globals.css           # Tailwind + glassmorphic utilities
        analyze/
          page.tsx            # NL query interface (client component)
        api/query/
          route.ts            # Claude NL→SQL (only serverless fn)
      components/
        layout/
          Navbar.tsx          # Fixed glass nav
          Footer.tsx
        landing/
          Hero.tsx            # Hero with animated stats
          Features.tsx        # 3 feature cards
          LiveDemo.tsx        # Chart preview (client)
        analyze/
          QueryInput.tsx      # NL input + example chips
          SQLDisplay.tsx      # Generated SQL code block
          ResultsTable.tsx    # Sortable data table
          ResultsChart.tsx    # Recharts (line/bar/pie)
          QueryHistory.tsx    # Recent queries sidebar
        ui/
          GlassCard.tsx       # Reusable glassmorphic card
      lib/
        duckdb.ts             # DuckDB-WASM singleton + table registry
        schemas.ts            # Table schemas (shared with API prompt)
        format.ts             # Currency/number formatting
        utils.ts              # cn() helper
      hooks/
        useDuckDB.ts          # DuckDB init + query execution hook
        useQuery.ts           # NL question → SQL → results orchestration
    public/
      data/                   # Pre-aggregated Parquet + JSON files
```

## Implementation Steps

### Step 1: Pre-aggregation script
Create `scripts/aggregate.py`. Read raw Parquet → produce 5 summary Parquet files + 3 JSON files → write to `web/public/data/`. Use existing `.venv`. **Verification**: print row counts and date ranges for each output file. Confirm sizes match expectations in the table above.

### Step 2: Scaffold Next.js project
`npx create-next-app@14 web` with TypeScript + Tailwind. Install all deps. Configure Tailwind theme (colors, fonts, animations). Set up `globals.css` with glassmorphic utility classes. **Verification**: `npm run build` succeeds.

### Step 3: Data layer
Build `lib/schemas.ts`, `lib/duckdb.ts`, `hooks/useDuckDB.ts`, `hooks/useQuery.ts`. **Verification**: `npm run build` succeeds with no SSR errors from WASM imports.

### Step 4: API route
Build `/api/query/route.ts`. **Verification**: `npm run build` succeeds.

### Step 5: Marketing landing page
Build `page.tsx` + Hero, Features, LiveDemo components. **Verification**: `npm run dev` → landing page renders with real stats from JSON files.

### Step 6: Query interface
Build `analyze/page.tsx` + all analyze components. **Verification**: DuckDB-WASM initializes in browser, end-to-end query works (type question → SQL generated → results displayed).

### Step 7: Shared UI polish
Build GlassCard, Navbar, Footer, formatters. Final polish pass. **Verification**: `npm run build` succeeds, ready for Vercel deploy.

---

## Guardrails — MUST FOLLOW

### Security
- **Never hardcode API keys.** Use `process.env.ANTHROPIC_API_KEY` only. Never commit `.env` files.
- **SQL injection prevention**: The API route MUST validate generated SQL before returning it. Reject any query containing DDL (`CREATE`, `DROP`, `ALTER`, `TRUNCATE`) or DML (`INSERT`, `UPDATE`, `DELETE`, `MERGE`). Only `SELECT` statements are allowed.
- **Query safety on client**: Wrap all DuckDB-WASM `query()` calls in try/catch. Limit result sets to 10,000 rows via `LIMIT` clause injection. Set a reasonable timeout.
- **API route input validation**: Validate that the incoming question is a string, under 500 characters, and non-empty.

### Data Protection
- **Never delete or overwrite the raw source Parquet file** (`Medicaid_Provider_Spending_2018_2024.parquet` or similar). It is read-only input.
- **Do not modify files outside the project directory.**

### WASM/SSR Boundary (the #1 build-failure risk)
- **All DuckDB-WASM imports MUST be dynamic imports inside client components only.** Never import `@duckdb/duckdb-wasm` at the top level of any server component or layout.
- Use `"use client"` directive on any component that touches DuckDB.
- Use `next/dynamic` with `{ ssr: false }` when embedding DuckDB-dependent components in server-rendered pages.

### Bundle Size
- Total `public/data/` directory must stay under 100MB. If `provider_summary.parquet` exceeds 50MB, further aggregate or filter.
- Do not install additional npm packages beyond the specified tech stack without documenting the reason in a code comment. Flag if any new dependency adds >10MB to the bundle.
- Pin all dependency versions in `package.json`. Do not use `latest` or `*` version ranges.

### API Cost Control
- Use `claude-sonnet-4-20250514` (not Opus) for the NL-to-SQL API route.
- Set `max_tokens: 1024` on Claude API calls — SQL responses do not need more.
- Temperature must be `0` for deterministic SQL generation.

### Error Handling
- Every async operation must have error handling. No unhandled promise rejections.
- The query interface must show user-friendly error messages, not raw stack traces.
- If DuckDB-WASM fails to initialize, show a clear message and disable the query input.

## Design Spec

Match the aesthetic of nofone.us:

- **Background**: `#0A0A0A`
- **Text colors**: white (headings), `#9CA3AF` (body), `#6B7280` (muted)
- **Orange accent**: `#EA580C` — CTAs, highlights, active states, chart primary color
- **Glass cards**: `bg-white/[0.03] backdrop-blur-md border border-white/[0.08]` with hover: `-translate-y-0.5` lift
- **Nav**: fixed position, `rgba(10,10,10,0.8)` background + `backdrop-blur-lg`
- **Animations**: fade-in-up on scroll, floating cards in hero, counter animations for stats
- **Border radius**: `rounded-xl` on cards, `rounded-lg` on inputs/buttons
- **Code blocks**: `bg-white/[0.05]` with JetBrains Mono font

## Environment Variables

Set in Vercel dashboard (and local `.env.local` for dev):

```
ANTHROPIC_API_KEY=sk-ant-...
```

That is the only required env var. Do not add others unless strictly necessary.

## Notes

- If years of data need trimming to fit size constraints, prefer dropping the oldest years first (keep 2020–2024 minimum).
- The Parquet files use snappy compression by default — do not change this.
- Recharts is preferred over other charting libs for consistency. Do not switch to Chart.js, D3, or others.
- For the NL-to-SQL prompt, include full table schemas with column names, types, and example values. Use the `generateSchemaPrompt()` function from `lib/schemas.ts`.
