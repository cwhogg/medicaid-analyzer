import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateSchemaPrompt } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateSQL } from "@/lib/sqlValidation";

const MAX_STEPS = 5;

interface PreviousStep {
  stepIndex: number;
  title: string;
  sql: string | null;
  resultSummary: string | null;
  insight: string | null;
  error: string | null;
}

interface AnalyzeRequest {
  question: string;
  years?: number[] | null;
  sessionId: string;
  stepIndex: number;
  previousSteps?: PreviousStep[];
  failedSql?: string;
  sqlError?: string;
}

function buildYearConstraint(yearFilter: number[] | null): string {
  if (!yearFilter) return "";
  if (yearFilter.length === 1) {
    const y = yearFilter[0];
    return `\n\nIMPORTANT: The user has selected year ${y} as a filter. You MUST add a WHERE clause to filter data to only year ${y}. For tables with a claim_month column, use: WHERE claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01'. For tables with a claim_year column, use: WHERE claim_year = ${y}.`;
  }
  const monthConditions = yearFilter.map((y) => `(claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01')`).join(" OR ");
  return `\n\nIMPORTANT: The user has selected years ${yearFilter.join(", ")} as a filter. You MUST add a WHERE clause to filter data to only these years. For tables with a claim_month column, use: WHERE ${monthConditions}. For tables with a claim_year column, use: WHERE claim_year IN (${yearFilter.join(", ")}).`;
}

function buildConversationHistory(
  question: string,
  stepIndex: number,
  previousSteps: PreviousStep[],
  failedSql?: string,
  sqlError?: string,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Initial user question
  messages.push({
    role: "user",
    content: `Analyze this question: ${question}`,
  });

  if (stepIndex === 0 && !failedSql) {
    // First call — Claude should return a plan + first step SQL
    return messages;
  }

  // Build conversation from previous steps
  for (const step of previousSteps) {
    // Claude's response for this step
    const assistantParts: string[] = [];
    if (step.title) assistantParts.push(`Step ${step.stepIndex + 1}: ${step.title}`);
    if (step.sql) assistantParts.push(`SQL: ${step.sql}`);
    if (step.insight) assistantParts.push(`Insight: ${step.insight}`);

    if (assistantParts.length > 0) {
      messages.push({ role: "assistant", content: assistantParts.join("\n") });
    }

    // User provides results or error
    if (step.error) {
      messages.push({
        role: "user",
        content: `Step ${step.stepIndex + 1} SQL failed with error: ${step.error}\nPlease continue the analysis, adjusting your approach as needed.`,
      });
    } else if (step.resultSummary) {
      messages.push({
        role: "user",
        content: `Step ${step.stepIndex + 1} results:\n${step.resultSummary}\n\nContinue the analysis.`,
      });
    }
  }

  // If this is a SQL retry for the current step
  if (failedSql && sqlError) {
    messages.push(
      { role: "assistant", content: failedSql },
      { role: "user", content: `That SQL query failed with this error:\n${sqlError}\n\nPlease fix the query. Respond with the same JSON format.` },
    );
  }

  return messages;
}

export async function POST(request: NextRequest) {
  try {
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

    const body: AnalyzeRequest = await request.json();
    const { question, years, sessionId, stepIndex, previousSteps = [], failedSql, sqlError } = body;

    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Question is required and must be a string." }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "Question must be under 500 characters." }, { status: 400 });
    }
    if (question.trim().length === 0) {
      return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
    }
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    }
    if (typeof stepIndex !== "number" || stepIndex < 0 || stepIndex >= MAX_STEPS) {
      return NextResponse.json({ error: `stepIndex must be 0-${MAX_STEPS - 1}.` }, { status: 400 });
    }

    const yearFilter: number[] | null = Array.isArray(years) && years.length > 0
      ? years.filter((y: unknown) => typeof y === "number" && y >= 2018 && y <= 2024).sort()
      : null;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const schemaPrompt = generateSchemaPrompt();
    const yearConstraint = buildYearConstraint(yearFilter);

    const isFirstStep = stepIndex === 0 && !failedSql;
    const remainingSteps = MAX_STEPS - stepIndex;

    const systemPrompt = `You are an expert data analyst performing multi-step analysis on a Medicaid provider spending dataset. You analyze data iteratively: plan steps, write SQL queries, interpret results, and synthesize insights.

${schemaPrompt}

You MUST respond with valid JSON only. No markdown, no code fences, no text outside the JSON.

${isFirstStep ? `This is the FIRST step. You must return a plan and the first SQL query.

Response format:
{
  "plan": ["Step 1 description", "Step 2 description", ...],
  "step": {
    "title": "Brief title for step 1",
    "sql": "SELECT ... FROM ... LIMIT ...",
    "chartType": "table|line|bar|pie"
  },
  "done": false,
  "stepIndex": 0
}` : `This is step ${stepIndex + 1} of the analysis. You have ${remainingSteps} step(s) remaining (including this one).

If you have enough information to provide a final summary, or this is the last step, set "done": true and include a "summary" field.

Response format for a continuing step:
{
  "step": {
    "title": "Brief title for this step",
    "sql": "SELECT ... FROM ... LIMIT ...",
    "chartType": "table|line|bar|pie"
  },
  "done": false,
  "stepIndex": ${stepIndex}
}

Response format for the final step (when done):
{
  "step": {
    "title": "Brief title for this step",
    "sql": "SELECT ... FROM ... LIMIT ...",
    "chartType": "table|line|bar|pie",
    "insight": "What this final query reveals"
  },
  "summary": "A comprehensive 2-4 paragraph summary synthesizing all findings from the analysis. Reference specific numbers and trends discovered. Highlight the most important insights.",
  "done": true,
  "stepIndex": ${stepIndex}
}

If no more SQL is needed and you just want to summarize:
{
  "summary": "Comprehensive summary...",
  "done": true,
  "stepIndex": ${stepIndex}
}`}

Rules:
- Each SQL query must be a valid DuckDB SELECT statement with a LIMIT clause (max 10000).
- Plan should have 2-5 steps. Each step should build on previous results.
- Keep step titles concise (under 60 characters).
- chartType should match the data shape: "line" for time series, "bar" for rankings, "pie" for proportions, "table" for detailed data.
- The "insight" field on each step is optional but encouraged — briefly describe what the step's results reveal.
- Use short, distinct table aliases and ensure every alias is defined in FROM or JOIN.${yearConstraint}`;

    const messages = buildConversationHistory(question, stepIndex, previousSteps, failedSql, sqlError);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No response generated." }, { status: 500 });
    }

    let responseText = textBlock.text.trim();

    // Strip markdown code fences if present
    if (responseText.startsWith("```")) {
      responseText = responseText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json({ error: "Failed to parse analysis response." }, { status: 500 });
    }

    // Validate SQL if present
    if (parsed.step?.sql) {
      let sql = parsed.step.sql.trim();
      if (sql.startsWith("```")) {
        sql = sql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "").trim();
        parsed.step.sql = sql;
      }

      const validation = validateSQL(sql);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    return NextResponse.json(parsed, {
      headers: { "X-RateLimit-Remaining": String(rateCheck.remaining) },
    });
  } catch (err) {
    console.error("Analyze API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
