#!/usr/bin/env npx tsx
/**
 * Dataset Validation & Evaluation Runner
 *
 * Layer 1: Executes gold SQL directly against Railway — validates data correctness
 * Layer 2: Sends NL questions to /api/query — validates NL-to-SQL pipeline
 *
 * Usage:
 *   npx tsx eval/run-eval.ts                     # Run both layers
 *   npx tsx eval/run-eval.ts --layer1-only        # SQL validation only
 *   npx tsx eval/run-eval.ts --layer2-only        # NL-to-SQL only
 *   npx tsx eval/run-eval.ts --dataset brfss      # Filter by dataset
 *   npx tsx eval/run-eval.ts --verbose            # Show full SQL + results
 *   npx tsx eval/run-eval.ts --save               # Save results to eval/results/
 */

import { TEST_CASES, type TestCase, type ExpectedResult } from "./ground-truth";
import { readFileSync } from "fs";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── Config ────────────────────────────────────────────────────

interface Config {
  railwayUrl: string;
  railwayApiKey: string;
  appBaseUrl: string;
  layer1: boolean;
  layer2: boolean;
  dataset: string | null;
  verbose: boolean;
  save: boolean;
}

function loadConfig(): Config {
  // Load .env.local from web/ directory
  const envPath = join(__dirname, "..", "web", ".env.local");
  try {
    const envContent = readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx);
      let val = trimmed.slice(eqIdx + 1);
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // .env.local not found — rely on env vars already set
  }

  const args = process.argv.slice(2);
  const hasFlag = (flag: string) => args.includes(flag);
  const getFlagValue = (flag: string): string | null => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const railwayUrl = process.env.RAILWAY_QUERY_URL;
  const railwayApiKey = process.env.RAILWAY_API_KEY;

  if (!railwayUrl) {
    console.error("Error: RAILWAY_QUERY_URL not set. Set it in env or web/.env.local");
    process.exit(1);
  }

  return {
    railwayUrl,
    railwayApiKey: railwayApiKey || "",
    appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    layer1: !hasFlag("--layer2-only"),
    layer2: !hasFlag("--layer1-only"),
    dataset: getFlagValue("--dataset"),
    verbose: hasFlag("--verbose"),
    save: hasFlag("--save"),
  };
}

// ─── Railway Direct SQL Execution ──────────────────────────────

async function executeSQL(
  config: Config,
  sql: string
): Promise<{ columns: string[]; rows: unknown[][] }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.railwayApiKey) {
    headers["Authorization"] = `Bearer ${config.railwayApiKey}`;
  }

  const response = await fetch(`${config.railwayUrl}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sql }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Railway error ${response.status}: ${body}`);
  }

  return (await response.json()) as { columns: string[]; rows: unknown[][] };
}

// ─── NL-to-SQL API Call ────────────────────────────────────────

interface ApiQueryResponse {
  sql: string;
  columns: string[];
  rows: unknown[][];
  chartType?: string;
  error?: string;
  cannotAnswer?: boolean;
}

async function executeNLQuery(
  config: Config,
  question: string,
  dataset: string
): Promise<ApiQueryResponse> {
  const response = await fetch(`${config.appBaseUrl}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, dataset }),
    signal: AbortSignal.timeout(120_000),
  });

  const data = (await response.json()) as ApiQueryResponse;

  if (!response.ok || data.error) {
    throw new Error(data.error || `API error ${response.status}`);
  }

  return data;
}

// ─── Result Checking ───────────────────────────────────────────

interface CheckResult {
  pass: boolean;
  expected: number;
  actual: number | null;
  deviation: number | null;
  tolerance: number;
  column: string;
  error?: string;
}

function checkExpected(
  columns: string[],
  rows: unknown[][],
  expected: ExpectedResult
): CheckResult {
  const colIdx = columns.findIndex(
    (c) => c.toLowerCase() === expected.column.toLowerCase()
  );

  if (colIdx === -1) {
    return {
      pass: false,
      expected: expected.value,
      actual: null,
      deviation: null,
      tolerance: expected.tolerance,
      column: expected.column,
      error: `Column "${expected.column}" not found in results. Available: ${columns.join(", ")}`,
    };
  }

  // Find the matching row (apply filter if specified)
  let targetRow: unknown[] | undefined;
  if (expected.filter) {
    for (const row of rows) {
      let matches = true;
      for (const [filterCol, filterVal] of Object.entries(expected.filter)) {
        const filterColIdx = columns.findIndex(
          (c) => c.toLowerCase() === filterCol.toLowerCase()
        );
        if (filterColIdx === -1 || String(row[filterColIdx]) !== filterVal) {
          matches = false;
          break;
        }
      }
      if (matches) {
        targetRow = row;
        break;
      }
    }
    if (!targetRow) {
      return {
        pass: false,
        expected: expected.value,
        actual: null,
        deviation: null,
        tolerance: expected.tolerance,
        column: expected.column,
        error: `No row matching filter ${JSON.stringify(expected.filter)}`,
      };
    }
  } else {
    targetRow = rows[0];
  }

  if (!targetRow) {
    return {
      pass: false,
      expected: expected.value,
      actual: null,
      deviation: null,
      tolerance: expected.tolerance,
      column: expected.column,
      error: "No rows returned",
    };
  }

  const rawValue = targetRow[colIdx];
  const actual =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string"
        ? parseFloat(rawValue)
        : null;

  if (actual === null || isNaN(actual as number)) {
    return {
      pass: false,
      expected: expected.value,
      actual: null,
      deviation: null,
      tolerance: expected.tolerance,
      column: expected.column,
      error: `Non-numeric value: ${rawValue}`,
    };
  }

  const deviation = Math.abs(actual - expected.value);
  return {
    pass: deviation <= expected.tolerance,
    expected: expected.value,
    actual,
    deviation: Math.round(deviation * 100) / 100,
    tolerance: expected.tolerance,
    column: expected.column,
  };
}

// ─── Formatting ────────────────────────────────────────────────

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

function passLabel(pass: boolean): string {
  return pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
}

// ─── Main Runner ───────────────────────────────────────────────

interface TestResult {
  testId: string;
  dataset: string;
  description: string;
  layer: 1 | 2;
  checks: CheckResult[];
  allPassed: boolean;
  sql?: string;
  generatedSql?: string;
  durationMs: number;
  error?: string;
}

async function runLayer1(
  config: Config,
  testCase: TestCase
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await executeSQL(config, testCase.sql);

    if (config.verbose) {
      console.log(`  ${DIM}SQL: ${testCase.sql.trim().replace(/\n\s+/g, " ")}${RESET}`);
      console.log(`  ${DIM}Result: ${JSON.stringify(result.rows[0])}${RESET}`);
    }

    const checks = testCase.expected.map((exp) =>
      checkExpected(result.columns, result.rows, exp)
    );

    return {
      testId: testCase.id,
      dataset: testCase.dataset,
      description: testCase.description,
      layer: 1,
      checks,
      allPassed: checks.every((c) => c.pass),
      sql: testCase.sql.trim(),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      testId: testCase.id,
      dataset: testCase.dataset,
      description: testCase.description,
      layer: 1,
      checks: [],
      allPassed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function runLayer2(
  config: Config,
  testCase: TestCase
): Promise<TestResult> {
  const start = Date.now();
  try {
    const result = await executeNLQuery(
      config,
      testCase.question,
      testCase.dataset
    );

    if (config.verbose) {
      console.log(`  ${DIM}Question: ${testCase.question}${RESET}`);
      console.log(`  ${DIM}Generated SQL: ${result.sql}${RESET}`);
      console.log(`  ${DIM}Result: ${JSON.stringify(result.rows[0])}${RESET}`);
    }

    const checks = testCase.expected.map((exp) =>
      checkExpected(result.columns, result.rows, exp)
    );

    return {
      testId: testCase.id,
      dataset: testCase.dataset,
      description: testCase.description,
      layer: 2,
      checks,
      allPassed: checks.every((c) => c.pass),
      generatedSql: result.sql,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      testId: testCase.id,
      dataset: testCase.dataset,
      description: testCase.description,
      layer: 2,
      checks: [],
      allPassed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const config = loadConfig();

  // Filter test cases
  let cases = TEST_CASES;
  if (config.dataset) {
    cases = cases.filter((tc) => tc.dataset === config.dataset);
  }

  if (cases.length === 0) {
    console.error("No test cases match the given filters.");
    process.exit(1);
  }

  console.log(`\n${BOLD}Dataset Validation & Evaluation${RESET}`);
  console.log(`${DIM}${"─".repeat(60)}${RESET}`);
  console.log(`Tests: ${cases.length} | Layers: ${config.layer1 && config.layer2 ? "1 + 2" : config.layer1 ? "1 only" : "2 only"}`);
  console.log(`Railway: ${config.railwayUrl}`);
  if (config.layer2) {
    console.log(`App: ${config.appBaseUrl}`);
  }
  console.log();

  const allResults: TestResult[] = [];

  // ── Layer 1: Direct SQL ──────────────────────────

  if (config.layer1) {
    console.log(`${BOLD}${CYAN}Layer 1: SQL Validation (Gold SQL → Railway)${RESET}\n`);

    for (const tc of cases) {
      process.stdout.write(`  ${tc.id} ... `);
      const result = await runLayer1(config, tc);
      allResults.push(result);

      if (result.error) {
        console.log(`${RED}ERROR${RESET} ${DIM}(${result.durationMs}ms)${RESET}`);
        console.log(`    ${RED}${result.error}${RESET}`);
      } else {
        for (const check of result.checks) {
          if (check.pass) {
            console.log(
              `${passLabel(true)} ${DIM}expected ${check.expected}, got ${check.actual} (±${check.deviation}pp, tol ±${check.tolerance}pp) [${result.durationMs}ms]${RESET}`
            );
          } else if (check.error) {
            console.log(`${passLabel(false)} ${check.error} ${DIM}[${result.durationMs}ms]${RESET}`);
          } else {
            console.log(
              `${passLabel(false)} expected ${check.expected}, got ${check.actual} ${RED}(±${check.deviation}pp, tol ±${check.tolerance}pp)${RESET} ${DIM}[${result.durationMs}ms]${RESET}`
            );
          }
        }
      }
    }
    console.log();
  }

  // ── Layer 2: NL-to-SQL ───────────────────────────

  if (config.layer2) {
    console.log(`${BOLD}${CYAN}Layer 2: NL-to-SQL Evaluation (Question → API → Check)${RESET}\n`);

    for (const tc of cases) {
      process.stdout.write(`  ${tc.id} ... `);
      const result = await runLayer2(config, tc);
      allResults.push(result);

      if (result.error) {
        console.log(`${RED}ERROR${RESET} ${DIM}(${result.durationMs}ms)${RESET}`);
        console.log(`    ${RED}${result.error}${RESET}`);
      } else {
        for (const check of result.checks) {
          if (check.pass) {
            console.log(
              `${passLabel(true)} ${DIM}expected ${check.expected}, got ${check.actual} (±${check.deviation}pp, tol ±${check.tolerance}pp) [${result.durationMs}ms]${RESET}`
            );
          } else if (check.error) {
            console.log(`${passLabel(false)} ${check.error} ${DIM}[${result.durationMs}ms]${RESET}`);
          } else {
            console.log(
              `${passLabel(false)} expected ${check.expected}, got ${check.actual} ${RED}(±${check.deviation}pp, tol ±${check.tolerance}pp)${RESET} ${DIM}[${result.durationMs}ms]${RESET}`
            );
          }
        }
      }
    }
    console.log();
  }

  // ── Summary ──────────────────────────────────────

  console.log(`${BOLD}Summary${RESET}`);
  console.log(`${DIM}${"─".repeat(60)}${RESET}`);

  const layer1Results = allResults.filter((r) => r.layer === 1);
  const layer2Results = allResults.filter((r) => r.layer === 2);

  for (const [label, results] of [
    ["Layer 1 (SQL)", layer1Results],
    ["Layer 2 (NL-to-SQL)", layer2Results],
  ] as const) {
    if (results.length === 0) continue;
    const passed = results.filter((r) => r.allPassed).length;
    const failed = results.length - passed;
    const color = failed === 0 ? GREEN : RED;
    console.log(
      `  ${label}: ${color}${passed}/${results.length} passed${RESET}` +
        (failed > 0 ? ` (${RED}${failed} failed${RESET})` : "")
    );
  }

  const totalPassed = allResults.filter((r) => r.allPassed).length;
  const totalFailed = allResults.length - totalPassed;

  console.log();
  if (totalFailed === 0) {
    console.log(`${GREEN}${BOLD}All ${totalPassed} tests passed!${RESET}\n`);
  } else {
    console.log(
      `${RED}${BOLD}${totalFailed} of ${allResults.length} tests failed.${RESET}\n`
    );

    // Diagnostic: if Layer 1 passes but Layer 2 fails, it's a schema/prompt issue
    for (const tc of cases) {
      const l1 = layer1Results.find((r) => r.testId === tc.id);
      const l2 = layer2Results.find((r) => r.testId === tc.id);
      if (l1 && l2 && l1.allPassed && !l2.allPassed) {
        console.log(
          `  ${YELLOW}Diagnostic:${RESET} ${tc.id} — data is correct (Layer 1 pass) but NL-to-SQL fails (Layer 2). Check schema prompt or system instructions.`
        );
      }
      if (l1 && !l1.allPassed) {
        console.log(
          `  ${YELLOW}Diagnostic:${RESET} ${tc.id} — data issue (Layer 1 fail). Check data ingestion for ${tc.dataset}.`
        );
      }
    }
    console.log();
  }

  // ── Save Results ─────────────────────────────────

  if (config.save) {
    const resultsDir = join(__dirname, "results");
    mkdirSync(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const resultsFile = join(resultsDir, `eval-${timestamp}.json`);

    const output = {
      timestamp: new Date().toISOString(),
      config: {
        railwayUrl: config.railwayUrl,
        appBaseUrl: config.appBaseUrl,
        layer1: config.layer1,
        layer2: config.layer2,
        datasetFilter: config.dataset,
      },
      summary: {
        total: allResults.length,
        passed: totalPassed,
        failed: totalFailed,
        layer1: {
          total: layer1Results.length,
          passed: layer1Results.filter((r) => r.allPassed).length,
        },
        layer2: {
          total: layer2Results.length,
          passed: layer2Results.filter((r) => r.allPassed).length,
        },
      },
      results: allResults,
    };

    writeFileSync(resultsFile, JSON.stringify(output, null, 2));
    console.log(`${DIM}Results saved to ${resultsFile}${RESET}\n`);
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
