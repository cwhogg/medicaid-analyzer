import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateSchemaPrompt } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateSQL, inferChartType } from "@/lib/sqlValidation";

// --- SQL Response Cache (LRU, keyed by normalized question) ---
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  sql: string;
  chartType: string;
  timestamp: number;
}

const sqlCache = new Map<string, CacheEntry>();

function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/[?.!]+$/, "").replace(/\s+/g, " ");
}

function getCachedSQL(question: string): CacheEntry | null {
  const key = normalizeQuestion(question);
  const entry = sqlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    sqlCache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  sqlCache.delete(key);
  sqlCache.set(key, entry);
  return entry;
}

function setCachedSQL(question: string, sql: string, chartType: string) {
  const key = normalizeQuestion(question);
  // Evict oldest entries if at capacity
  if (sqlCache.size >= CACHE_MAX_SIZE) {
    const firstKey = sqlCache.keys().next().value;
    if (firstKey !== undefined) sqlCache.delete(firstKey);
  }
  sqlCache.set(key, { sql, chartType, timestamp: Date.now() });
}

// --- Route Handler ---
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfterSec} seconds.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await request.json();
    const { question, years, failedSql, sqlError } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required and must be a string." }, { status: 400 });
    }

    if (question.length > 500) {
      return NextResponse.json({ error: "Question must be under 500 characters." }, { status: 400 });
    }

    if (question.trim().length === 0) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }

    // Validate years if provided
    const yearFilter: number[] | null = Array.isArray(years) && years.length > 0
      ? years.filter((y: unknown) => typeof y === "number" && y >= 2018 && y <= 2024).sort()
      : null;

    // Check cache (only for first attempts, not retries)
    const cacheQuestion = yearFilter ? `${question} [years:${yearFilter.join(",")}]` : question;
    if (!failedSql) {
      const cached = getCachedSQL(cacheQuestion);
      if (cached) {
        return NextResponse.json(
          { sql: cached.sql, chartType: cached.chartType, cached: true },
          { headers: { "X-RateLimit-Remaining": String(rateCheck.remaining), "X-Cache": "HIT" } }
        );
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const schemaPrompt = generateSchemaPrompt();

    let yearConstraint = "";
    if (yearFilter && yearFilter.length === 1) {
      const y = yearFilter[0];
      yearConstraint = `\n\nIMPORTANT: The user has selected year ${y} as a filter. You MUST add a WHERE clause to filter data to only year ${y}. For tables with a claim_month column, use: WHERE claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01'. For tables with a claim_year column, use: WHERE claim_year = ${y}.`;
    } else if (yearFilter && yearFilter.length > 1) {
      const monthConditions = yearFilter.map((y) => `(claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01')`).join(" OR ");
      yearConstraint = `\n\nIMPORTANT: The user has selected years ${yearFilter.join(", ")} as a filter. You MUST add a WHERE clause to filter data to only these years. For tables with a claim_month column, use: WHERE ${monthConditions}. For tables with a claim_year column, use: WHERE claim_year IN (${yearFilter.join(", ")}).`;
    }

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: question },
    ];

    // If retrying after a SQL error, include the failed attempt so Claude can fix it
    if (failedSql && sqlError) {
      messages.push(
        { role: "assistant", content: failedSql },
        { role: "user", content: `That SQL query failed with this error:\n${sqlError}\n\nPlease fix the query and return only the corrected SQL.` },
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      system: `You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicaid provider spending dataset.

${schemaPrompt}

Rules:
- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.
- Always include a LIMIT clause (max 10000).
- Only use SELECT statements.
- Use the table names exactly as defined (monthly_totals, hcpcs_summary, hcpcs_monthly, provider_summary, top_providers_monthly, hcpcs_lookup, npi_lookup).
- Use DuckDB SQL syntax.
- Format dollar amounts with ROUND() for readability.
- When a question is ambiguous, make reasonable assumptions and use the most appropriate table.
- Use short, distinct table aliases (e.g. hs, hm, ps, tpm, hl, nl) and ensure every alias referenced in the query is defined in a FROM or JOIN clause.${yearConstraint}`,
      messages,
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No SQL generated." }, { status: 500 });
    }

    let sql = textBlock.text.trim();

    // Strip markdown code fences if present
    if (sql.startsWith("```")) {
      sql = sql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const validation = validateSQL(sql);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const chartType = inferChartType(sql, question);

    // Cache the result (only for first attempts, not retries)
    if (!failedSql) {
      setCachedSQL(cacheQuestion, sql, chartType);
    }

    return NextResponse.json(
      { sql, chartType },
      { headers: { "X-RateLimit-Remaining": String(rateCheck.remaining), "X-Cache": "MISS" } }
    );
  } catch (err) {
    console.error("Query API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
