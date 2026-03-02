import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDataset } from "@/lib/datasets/index";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateSQL, inferChartType } from "@/lib/sqlValidation";
import { executeRemoteQuery } from "@/lib/railway";
import { recordRequest, recordQuery, recordFeedItem } from "@/lib/metrics";

export const maxDuration = 60; // Allow up to 60s for Claude + Railway query

// --- Response Cache (LRU, keyed by normalized question) ---
const CACHE_MAX_SIZE = 500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  sql: string;
  chartType: string;
  columns: string[];
  rows: unknown[][];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function normalizeQuestion(q: string): string {
  return q.toLowerCase().trim().replace(/[?.!]+$/, "").replace(/\s+/g, " ");
}

function getCached(question: string): CacheEntry | null {
  const key = normalizeQuestion(question);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used)
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function setCache(question: string, entry: Omit<CacheEntry, "timestamp">) {
  const key = normalizeQuestion(question);
  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, { ...entry, timestamp: Date.now() });
}

// --- Route Handler ---
export async function POST(request: NextRequest) {
  const requestStart = Date.now();
  try {
    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || "unknown";

    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 429, totalMs: Date.now() - requestStart, cached: false, dataset: "unknown" });
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
    const { question, years, dataset: datasetKey } = body as { question?: string; years?: unknown; dataset?: string };

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required and must be a string." }, { status: 400 });
    }

    if (question.length > 500) {
      return NextResponse.json({ error: "Question must be under 500 characters." }, { status: 400 });
    }

    if (question.trim().length === 0) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }

    // Resolve dataset config (defaults to "medicaid" for unknown values)
    let config;
    try {
      config = getDataset(datasetKey || "medicaid");
    } catch {
      config = getDataset("medicaid");
    }
    const selectedDataset = config.key;

    // Check if question is obviously outside dataset scope
    if (config.checkDataScope) {
      const scopeError = config.checkDataScope(question);
      if (scopeError) {
        recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 422, totalMs: Date.now() - requestStart, cached: false, dataset: selectedDataset });
        recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql: null, status: 422, totalMs: Date.now() - requestStart, cached: false, error: scopeError, dataset: selectedDataset });
        return NextResponse.json(
          { error: scopeError, cannotAnswer: true },
          { status: 422, headers: { "X-RateLimit-Remaining": String(rateCheck.remaining) } }
        );
      }
    }

    // Validate years if dataset supports year filtering
    let yearFilter: number[] | null = null;
    if (config.yearFilter && Array.isArray(years) && years.length > 0) {
      const validYears = config.yearFilter.years;
      yearFilter = years
        .filter((y: unknown) => typeof y === "number" && validYears.includes(y))
        .sort() as number[];
      if (yearFilter.length === 0) yearFilter = null;
    }

    // Check cache
    const cacheQuestion = `${selectedDataset}::` + (yearFilter ? `${question} [years:${yearFilter.join(",")}]` : question);
    const cached = getCached(cacheQuestion);
    if (cached) {
      recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 200, totalMs: Date.now() - requestStart, cached: true, dataset: selectedDataset });
      return NextResponse.json(
        { sql: cached.sql, chartType: cached.chartType, columns: cached.columns, rows: cached.rows, cached: true },
        { headers: { "X-RateLimit-Remaining": String(rateCheck.remaining), "X-Cache": "HIT" } }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const schemaPrompt = config.generateSchemaPrompt();

    let yearConstraint = "";
    if (yearFilter && config.buildYearConstraint) {
      yearConstraint = config.buildYearConstraint(yearFilter);
    }

    // Generate SQL
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: question },
    ];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Build system prompt with caching — schema is static and cached across requests
    const staticSystemPrompt = `${config.systemPromptPreamble}

${schemaPrompt}

${config.systemPromptRules}`;

    const systemBlocks: Anthropic.TextBlockParam[] = [
      { type: "text", text: staticSystemPrompt, cache_control: { type: "ephemeral" } },
    ];
    if (yearConstraint) {
      systemBlocks.push({ type: "text", text: yearConstraint });
    }

    const claudeStart = Date.now();
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0,
      system: systemBlocks,
      messages,
    });
    const claudeMs = Date.now() - claudeStart;
    totalInputTokens += message.usage.input_tokens;
    totalOutputTokens += message.usage.output_tokens;

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No SQL generated." }, { status: 500 });
    }

    let sql = textBlock.text.trim();

    // Handle CANNOT_ANSWER refusals
    if (sql.startsWith("CANNOT_ANSWER:")) {
      const explanation = sql.slice("CANNOT_ANSWER:".length).trim();
      recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 422, claudeMs, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, dataset: selectedDataset });
      recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql: null, status: 422, totalMs: Date.now() - requestStart, cached: false, error: explanation, dataset: selectedDataset });
      return NextResponse.json(
        { error: explanation, cannotAnswer: true },
        { status: 422, headers: { "X-RateLimit-Remaining": String(rateCheck.remaining) } }
      );
    }

    // Strip markdown code fences if present
    if (sql.startsWith("```")) {
      sql = sql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    const validation = validateSQL(sql);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const chartType = inferChartType(sql, question);

    // Execute SQL via Railway
    let columns: string[];
    let rows: unknown[][];
    const railwayStart = Date.now();
    try {
      const result = await executeRemoteQuery(sql, selectedDataset);
      columns = result.columns;
      rows = result.rows;
    } catch (execErr) {
      const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
      const isSqlError = /binder error|parser error|catalog error|not implemented|no such|not found|does not have/i.test(errMsg);

      if (!isSqlError) {
        recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 500, claudeMs, railwayMs: Date.now() - railwayStart, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, dataset: selectedDataset });
        recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql, status: 500, totalMs: Date.now() - requestStart, cached: false, error: errMsg, dataset: selectedDataset });
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      // Retry: ask Claude to fix the SQL (reuses cached schema prompt)
      const retryStaticPrompt = `${config.systemPromptPreamble}

${schemaPrompt}

${config.retrySystemPromptRules}`;

      const retrySystemBlocks: Anthropic.TextBlockParam[] = [
        { type: "text", text: retryStaticPrompt, cache_control: { type: "ephemeral" } },
      ];
      if (yearConstraint) {
        retrySystemBlocks.push({ type: "text", text: yearConstraint });
      }

      const retryClaudeStart = Date.now();
      const retryMessage = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0,
        system: retrySystemBlocks,
        messages: [
          { role: "user", content: question },
          { role: "assistant", content: sql },
          { role: "user", content: `That SQL query failed with this error:\n${errMsg}\n\nPlease fix the query and return only the corrected SQL.` },
        ],
      });
      totalInputTokens += retryMessage.usage.input_tokens;
      totalOutputTokens += retryMessage.usage.output_tokens;

      const retryBlock = retryMessage.content.find((block) => block.type === "text");
      if (!retryBlock || retryBlock.type !== "text") {
        recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 500, claudeMs: claudeMs + (Date.now() - retryClaudeStart), railwayMs: Date.now() - railwayStart, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
        recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql, status: 500, totalMs: Date.now() - requestStart, cached: false, error: errMsg, dataset: selectedDataset });
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      let fixedSql = retryBlock.text.trim();
      if (fixedSql.startsWith("```")) {
        fixedSql = fixedSql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "").trim();
      }

      const retryValidation = validateSQL(fixedSql);
      if (!retryValidation.valid) {
        recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 500, claudeMs: claudeMs + (Date.now() - retryClaudeStart), railwayMs: Date.now() - railwayStart, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
        recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql, status: 500, totalMs: Date.now() - requestStart, cached: false, error: errMsg, dataset: selectedDataset });
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }

      try {
        const retryResult = await executeRemoteQuery(fixedSql, selectedDataset);
        sql = fixedSql;
        columns = retryResult.columns;
        rows = retryResult.rows;
      } catch {
        recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 500, claudeMs: claudeMs + (Date.now() - retryClaudeStart), railwayMs: Date.now() - railwayStart, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
        recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql, status: 500, totalMs: Date.now() - requestStart, cached: false, error: errMsg, dataset: selectedDataset });
        return NextResponse.json({ error: errMsg }, { status: 500 });
      }
    }
    const railwayMs = Date.now() - railwayStart;

    // Cache the result
    setCache(cacheQuestion, { sql, chartType, columns, rows });

    recordRequest({ timestamp: Date.now(), route: "/api/query", ip, status: 200, claudeMs, railwayMs, totalMs: Date.now() - requestStart, cached: false, inputTokens: totalInputTokens, outputTokens: totalOutputTokens, dataset: selectedDataset });
    recordQuery({ timestamp: Date.now(), ip, route: "/api/query", question, sql, status: 200, totalMs: Date.now() - requestStart, cached: false, dataset: selectedDataset });
    recordFeedItem({
      id: crypto.randomUUID(),
      question,
      route: "query",
      timestamp: Date.now(),
      rowCount: rows.length,
      resultData: { sql, chartType, columns, rows: rows.slice(0, 200) },
    });

    return NextResponse.json(
      { sql, chartType, columns, rows },
      { headers: { "X-RateLimit-Remaining": String(rateCheck.remaining), "X-Cache": "MISS" } }
    );
  } catch (err) {
    console.error("Query API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
