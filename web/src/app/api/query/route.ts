import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateSchemaPrompt } from "@/lib/schemas";

const FORBIDDEN_KEYWORDS = [
  "CREATE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "GRANT",
  "REVOKE",
  "EXEC",
  "EXECUTE",
  "CALL",
  "COPY",
  "ATTACH",
  "DETACH",
  "LOAD",
  "INSTALL",
  "PRAGMA",
];

function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim().replace(/;+$/, "").trim();
  const upper = trimmed.toUpperCase();

  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    return { valid: false, error: "Only SELECT queries are allowed." };
  }

  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(upper)) {
      return { valid: false, error: `Forbidden SQL keyword detected: ${keyword}` };
    }
  }

  return { valid: true };
}

function inferChartType(sql: string, question: string): "table" | "line" | "bar" | "pie" {
  const q = question.toLowerCase();
  const s = sql.toLowerCase();

  if (q.includes("trend") || q.includes("over time") || q.includes("monthly") || q.includes("by month") || q.includes("by year")) {
    return "line";
  }
  if (q.includes("top") || q.includes("compare") || q.includes("ranking") || q.includes("highest") || q.includes("largest")) {
    return "bar";
  }
  if (q.includes("breakdown") || q.includes("distribution") || q.includes("share") || q.includes("proportion") || q.includes("percentage")) {
    return "pie";
  }
  if (s.includes("claim_month") || s.includes("date_trunc") || s.includes("extract(year")) {
    return "line";
  }
  if (s.includes("order by") && s.includes("limit")) {
    return "bar";
  }

  return "table";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, failedSql, sqlError } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required and must be a string." }, { status: 400 });
    }

    if (question.length > 500) {
      return NextResponse.json({ error: "Question must be under 500 characters." }, { status: 400 });
    }

    if (question.trim().length === 0) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const schemaPrompt = generateSchemaPrompt();

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
- Use short, distinct table aliases (e.g. hs, hm, ps, tpm, hl, nl) and ensure every alias referenced in the query is defined in a FROM or JOIN clause.`,
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

    return NextResponse.json({ sql, chartType });
  } catch (err) {
    console.error("Query API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
