import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDataset } from "@/lib/datasets/index";

export const maxDuration = 60;

const ADMIN_SECRET = process.env.ADMIN_API_KEY;
const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

function railwayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (RAILWAY_API_KEY) {
    headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
  }
  return headers;
}

// POST — AI-assisted refinement of an idea
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }
  if (!RAILWAY_QUERY_URL) {
    return Response.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  const { id } = await params;

  let feedback: string | undefined;
  try {
    const body = await request.json();
    if (body.feedback && typeof body.feedback === "string") {
      feedback = body.feedback.trim();
    }
  } catch {
    // No body
  }

  // Fetch current idea
  const getRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
    headers: railwayHeaders(),
  });
  if (!getRes.ok) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }
  const { idea } = await getRes.json();
  const data = idea.data || {};
  const dataset = data.dataset || "medicaid";
  const dsConfig = getDataset(dataset);
  const schemaPrompt = dsConfig.generateSchemaPrompt();

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You refine blog post ideas for a public health data analysis site. The idea is about the ${dsConfig.label} dataset.

CRITICAL: Your analysisQuestions MUST be answerable using ONLY the columns listed in the schema below.

${schemaPrompt}

Given the current idea and optional feedback, return an improved version as a JSON object with these fields:
- title: An engaging QUESTION that a curious person would search for (50-70 chars). Must end with a question mark. Examples: "How Many Americans Have Diabetes and Don't Know It?", "Does Where You Live Predict Your Health?". Never use colon-separated labels like "Topic: Subtitle" — always a natural question.
- description: Brief summary (1-2 sentences)
- targetKeywords: array of 3-5 SEO keywords
- contentGap: what gap this content fills (1 sentence)
- analysisQuestions: array of 2-3 specific analytical questions (MUST use only columns from the schema)

Return ONLY valid JSON, no markdown fences or explanation.`;

  const userMessage = `Current idea:
Title: ${data.title}
Description: ${data.description}
Keywords: ${(data.targetKeywords || []).join(", ")}
Content gap: ${data.contentGap}
Analysis questions:
${(data.analysisQuestions || []).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

${feedback ? `User feedback for improvement:\n${feedback}` : "Please improve this idea — make the title more compelling, sharpen the analysis questions, and improve keyword targeting."}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.5,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "Claude returned no text" }, { status: 500 });
    }

    let improved: {
      title: string;
      description: string;
      targetKeywords: string[];
      contentGap: string;
      analysisQuestions: string[];
    };
    try {
      const cleaned = textBlock.text
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      improved = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "Claude returned invalid JSON", raw: textBlock.text },
        { status: 500 }
      );
    }

    // Merge improved fields into data
    data.title = improved.title;
    data.description = improved.description;
    data.targetKeywords = improved.targetKeywords;
    data.contentGap = improved.contentGap;
    data.analysisQuestions = improved.analysisQuestions;
    data.status = "improved";
    data.updatedAt = Date.now();

    const actions = Array.isArray(data.actions) ? data.actions : [];
    actions.push({
      type: "improved",
      timestamp: Date.now(),
      details: feedback || undefined,
    });
    data.actions = actions;

    // Update in Railway
    const patchRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
      method: "PATCH",
      headers: railwayHeaders(),
      body: JSON.stringify({ data, status: "improved" }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      return Response.json({ error: `Update failed: ${err}` }, { status: 500 });
    }

    return Response.json({ ok: true, idea: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Improve failed";
    console.error("Idea improve error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
