import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateSchemaPrompt } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateSQL } from "@/lib/sqlValidation";
import { executeRemoteQuery } from "@/lib/railway";
import { summarizeResults } from "@/lib/summarize";

export const maxDuration = 120;

const MAX_STEPS = 5; // step 0 = plan, steps 1-4 = SQL queries

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
}

function buildYearConstraint(yearFilter: number[] | null): string {
  if (!yearFilter) return "";
  if (yearFilter.length === 1) {
    const y = yearFilter[0];
    return `\n\nIMPORTANT: The user has selected year ${y} as a filter. You MUST add a WHERE clause to filter data to only year ${y}. Use: WHERE claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01'.`;
  }
  const monthConditions = yearFilter.map((y) => `(claim_month >= '${y}-01-01' AND claim_month < '${y + 1}-01-01')`).join(" OR ");
  return `\n\nIMPORTANT: The user has selected years ${yearFilter.join(", ")} as a filter. You MUST add a WHERE clause to filter data to only these years. Use: WHERE ${monthConditions}.`;
}

function buildConversationHistory(
  question: string,
  stepIndex: number,
  previousSteps: PreviousStep[],
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Initial user question
  messages.push({
    role: "user",
    content: `Analyze this question: ${question}`,
  });

  if (stepIndex === 0) {
    return messages;
  }

  // Build conversation from previous steps
  for (const step of previousSteps) {
    // Assistant message includes reasoning context
    const assistantParts: string[] = [];
    if (step.title) assistantParts.push(`Step ${step.stepIndex}: ${step.title}`);
    if (step.sql) assistantParts.push(`SQL: ${step.sql}`);
    if (step.insight) assistantParts.push(`Interpretation: ${step.insight}`);

    if (assistantParts.length > 0) {
      messages.push({ role: "assistant", content: assistantParts.join("\n") });
    }

    if (step.error) {
      messages.push({
        role: "user",
        content: `Step ${step.stepIndex} SQL failed with error: ${step.error}\nAdjust your approach for the next step. Consider whether the error reveals something about the data structure.`,
      });
    } else if (step.resultSummary) {
      messages.push({
        role: "user",
        content: `Step ${step.stepIndex} results:\n${step.resultSummary}\n\nConsider whether these results confirm or challenge your hypothesis. What is the most important next question to answer? Continue the analysis.`,
      });
    } else {
      // Plan step or step with no SQL results — still need a user turn
      messages.push({
        role: "user",
        content: `Plan confirmed. Now execute step 1 of the analysis.`,
      });
    }
  }

  return messages;
}

function buildSystemPrompt(
  schemaPrompt: string,
  yearConstraint: string,
  stepIndex: number,
  remainingSteps: number,
): string {
  const analyticalFramework = `You are a senior health policy data analyst performing a rigorous multi-step investigation of a Medicaid provider spending dataset. You think like an expert: decompose problems, form hypotheses, query strategically, interpret results critically, and adapt your plan based on what you find.

## Analytical Framework
1. DECOMPOSE: Break the question into distinct analytical sub-questions
2. HYPOTHESIZE: Before each query, state what you expect to find and why
3. QUERY: Write targeted SQL that tests your hypothesis
4. INTERPRET: Explain what the results mean, citing specific numbers
5. ADAPT: Revise your plan if results are surprising or reveal new angles

## Medicaid Domain Knowledge
- Spending is highly concentrated: a small number of providers and procedures account for the majority of dollars
- J-codes (injections/drugs) dominate high-cost procedures — J0178 (aflibercept), J9312 (rituximab), J1745 (infliximab) are common top spenders
- Geographic variation is significant — states like CA, NY, TX, FL have the highest total spending but per-provider averages vary
- Seasonal patterns exist: some procedures spike in Q1 (flu season), behavioral health utilization shows summer dips
- Oct-Dec 2024 data is INCOMPLETE — always truncate time series at Sept 2024 or note the incompleteness
- Remote Patient Monitoring (RPM) and Chronic Care Management (CCM) are rapidly growing categories
- Provider types matter: Organizations vs Individual providers show different spending patterns`;

  const basePrompt = `${analyticalFramework}

${schemaPrompt}

You MUST respond with valid JSON only. No markdown, no code fences, no text outside the JSON.`;

  if (stepIndex === 0) {
    // Plan-only step — NO SQL query
    return `${basePrompt}

This is the PLANNING step. Analyze the question and create an investigation plan. Do NOT write any SQL yet — just plan.

Assess the question complexity:
- "simple": straightforward lookup or single aggregation (2 SQL steps)
- "moderate": requires comparison, trend analysis, or joining multiple dimensions (3 SQL steps)
- "complex": multi-faceted investigation requiring hypothesis testing across dimensions (4 SQL steps)

Response format:
{
  "plan": [
    { "stepNumber": 1, "title": "Brief title", "purpose": "What hypothesis this step tests or what question it answers" },
    { "stepNumber": 2, "title": "Brief title", "purpose": "..." }
  ],
  "reasoning": "2-3 sentences explaining your overall analytical approach and key hypotheses",
  "complexity": "simple|moderate|complex",
  "stepIndex": 0,
  "done": false
}

Rules for planning:
- Each step MUST have a distinct analytical purpose — not generic "look at data"
- Steps should build on each other: later steps should test hypotheses raised by earlier results
- Plan 2 steps for simple, 3 for moderate, 4 for complex questions
- The final step should synthesize or compare, not just fetch more data
- Good step purposes: "Test whether spending concentration follows Pareto pattern", "Identify if the growth is driven by volume or price increases", "Compare geographic distribution to identify outlier states"
- Bad step purposes: "Get more data", "Look at trends", "Check the numbers"${yearConstraint}`;
  }

  // Execution steps (1+)
  return `${basePrompt}

This is step ${stepIndex} of the analysis. You have ${remainingSteps} step(s) remaining (including this one).

${remainingSteps === 1 ? "This is your FINAL step. You MUST set \"done\": true and include a comprehensive \"summary\" field." : ""}

Response format for a continuing step:
{
  "step": {
    "title": "Brief title for this step",
    "sql": "SELECT ... FROM ... LIMIT ...",
    "chartType": "table|line|bar|pie",
    "insight": "Interpret the results: what do the numbers mean? Cite specific values. Did they confirm or challenge your hypothesis?"
  },
  "reasoning": "Why this specific query, what hypothesis it tests",
  ${remainingSteps > 1 ? '"revisedPlan": null,' : ""}
  "done": false,
  "stepIndex": ${stepIndex}
}

Response format for the final step (when done):
{
  "step": {
    "title": "Brief title for this step",
    "sql": "SELECT ... FROM ... LIMIT ...",
    "chartType": "table|line|bar|pie",
    "insight": "What this final query reveals — cite specific numbers"
  },
  "summary": "A comprehensive 2-4 paragraph summary synthesizing ALL findings. Structure: (1) Direct answer to the question with key numbers, (2) Most surprising or important findings, (3) Caveats or context needed to interpret the results. Reference specific numbers from each step.",
  "done": true,
  "stepIndex": ${stepIndex}
}

If no more SQL is needed and you just want to summarize:
{
  "summary": "Comprehensive summary...",
  "done": true,
  "stepIndex": ${stepIndex}
}

${remainingSteps > 1 ? `If the previous results surprised you or revealed a more important angle, you may revise the remaining plan:
"revisedPlan": [
  { "stepNumber": ${stepIndex + 1}, "title": "New title", "purpose": "New purpose" },
  ...
]
Set "revisedPlan" to null if the original plan still makes sense.` : ""}

Rules:
- Each SQL query must be a valid DuckDB SELECT statement with a LIMIT clause (max 10000).
- Keep step titles concise (under 60 characters).
- chartType should match the data shape: "line" for time series, "bar" for rankings/comparisons, "pie" for proportions (only if <8 categories), "table" for detailed data.
- The "insight" field is REQUIRED — briefly interpret the results, citing specific numbers. Don't just describe the query.
- Use short, distinct table aliases and ensure every alias is defined in FROM or JOIN.
- If the available tables cannot answer a specific step, include "cannotAnswer" instead of "sql".${yearConstraint}`;
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
    const { question, years, sessionId, stepIndex, previousSteps = [] } = body;

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
    const remainingSteps = MAX_STEPS - stepIndex;

    const systemPrompt = buildSystemPrompt(schemaPrompt, yearConstraint, stepIndex, remainingSteps);
    const messages = buildConversationHistory(question, stepIndex, previousSteps);

    const response = await client.messages.create({
      model: "claude-opus-4-20250514",
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

    // Step 0: plan-only — convert rich plan to string[] for UI
    if (stepIndex === 0 && parsed.plan && Array.isArray(parsed.plan)) {
      const richPlan = parsed.plan;
      // Convert rich plan objects to display strings
      if (richPlan.length > 0 && typeof richPlan[0] === "object") {
        parsed.plan = richPlan.map((s: { title?: string; purpose?: string; stepNumber?: number }) =>
          `${s.title || `Step ${s.stepNumber}`}: ${s.purpose || ""}`
        );
      }
      // Plan-only step — no SQL to execute, return immediately
      return NextResponse.json(parsed, {
        headers: { "X-RateLimit-Remaining": String(rateCheck.remaining) },
      });
    }

    // Handle revisedPlan — convert rich objects to string[]
    if (parsed.revisedPlan && Array.isArray(parsed.revisedPlan)) {
      const richPlan = parsed.revisedPlan;
      if (richPlan.length > 0 && typeof richPlan[0] === "object") {
        parsed.revisedPlan = richPlan.map((s: { title?: string; purpose?: string; stepNumber?: number }) =>
          `${s.title || `Step ${s.stepNumber}`}: ${s.purpose || ""}`
        );
      }
      // Wrap revisedPlan as plan for the client
      parsed.plan = parsed.revisedPlan;
      delete parsed.revisedPlan;
    }

    // Validate and execute SQL if present
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

      // Execute SQL via Railway
      try {
        const result = await executeRemoteQuery(sql);
        parsed.step.columns = result.columns;
        parsed.step.rows = result.rows;
        parsed.step.resultSummary = summarizeResults(result.columns, result.rows);
      } catch (execErr) {
        const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
        const isSqlError = /binder error|parser error|catalog error|not implemented|no such|not found|does not have/i.test(errMsg);

        if (isSqlError) {
          // Retry: ask Claude to fix the SQL
          try {
            const retryMessages = [...messages];
            retryMessages.push(
              { role: "assistant", content: sql },
              { role: "user", content: `That SQL query failed with this error:\n${errMsg}\n\nPlease fix the query. Respond with the same JSON format.` },
            );

            const retryResponse = await client.messages.create({
              model: "claude-opus-4-20250514",
              max_tokens: 2048,
              temperature: 0,
              system: systemPrompt,
              messages: retryMessages,
            });

            const retryBlock = retryResponse.content.find((b) => b.type === "text");
            if (retryBlock && retryBlock.type === "text") {
              let retryText = retryBlock.text.trim();
              if (retryText.startsWith("```")) {
                retryText = retryText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
              }
              const retryParsed = JSON.parse(retryText);
              if (retryParsed.step?.sql) {
                let fixedSql = retryParsed.step.sql.trim();
                if (fixedSql.startsWith("```")) {
                  fixedSql = fixedSql.replace(/^```(?:sql)?\n?/, "").replace(/\n?```$/, "").trim();
                }
                const retryValidation = validateSQL(fixedSql);
                if (retryValidation.valid) {
                  const retryResult = await executeRemoteQuery(fixedSql);
                  parsed.step.sql = fixedSql;
                  parsed.step.columns = retryResult.columns;
                  parsed.step.rows = retryResult.rows;
                  parsed.step.resultSummary = summarizeResults(retryResult.columns, retryResult.rows);
                  if (retryParsed.step.title) parsed.step.title = retryParsed.step.title;
                  if (retryParsed.step.chartType) parsed.step.chartType = retryParsed.step.chartType;
                  if (retryParsed.step.insight) parsed.step.insight = retryParsed.step.insight;
                }
              }
            }
          } catch {
            // Retry failed — attach the error to the step
            parsed.step.error = errMsg;
            parsed.step.columns = [];
            parsed.step.rows = [];
          }
        } else {
          parsed.step.error = errMsg;
          parsed.step.columns = [];
          parsed.step.rows = [];
        }
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
