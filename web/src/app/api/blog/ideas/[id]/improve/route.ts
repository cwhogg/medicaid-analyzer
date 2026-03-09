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

// POST — AI-assisted refinement of an idea or generated article
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

  const client = new Anthropic({ apiKey });

  // Branch based on status
  if (data.status === "generated") {
    return improveArticle(id, data, feedback, client);
  }
  return improveIdea(id, data, feedback, client);
}

// Refine idea metadata (pending/improved status)
async function improveIdea(
  id: string,
  data: Record<string, unknown>,
  feedback: string | undefined,
  client: Anthropic
) {
  const dataset = (data.dataset as string) || "medicaid";
  const dsConfig = getDataset(dataset);
  const schemaPrompt = dsConfig.generateSchemaPrompt();

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
Keywords: ${((data.targetKeywords as string[]) || []).join(", ")}
Content gap: ${data.contentGap}
Analysis questions:
${((data.analysisQuestions as string[]) || []).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}

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

// Refine generated article content
async function improveArticle(
  id: string,
  data: Record<string, unknown>,
  feedback: string | undefined,
  client: Anthropic
) {
  if (!feedback) {
    return Response.json({ error: "Feedback is required to improve a generated article" }, { status: 400 });
  }
  if (!data.generatedContent) {
    return Response.json({ error: "No generated content to improve" }, { status: 400 });
  }

  const dataset = (data.dataset as string) || "medicaid";
  const dsConfig = getDataset(dataset);

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0.3,
      system: `You are a data journalist editing an article for Open Health Data Hub. This article is about ${dsConfig.label} data.

Rules:
- Apply the requested improvements while preserving the article's data accuracy
- ONLY cite numbers that appear in the existing article — never fabricate statistics
- Keep markdown formatting with ## headings. Do NOT include the article title as an H1. Do NOT include frontmatter.
- Maximum ONE table, ≤ 8 rows
- Target 650-850 words. Cut filler to stay in range.
- Bold sparingly — only the 1-2 most important numbers per section, not every number
- Limit em dashes to 2 per article
- Do NOT explain what the dataset is to the reader
- Vary paragraph and section length — not every finding needs 3 paragraphs
- NEVER use: "it's worth noting", "taken together", "the broader takeaway", "several patterns jump out", "several factors could explain", "warrants further investigation", "what makes this finding particularly significant", "one hypothesis:", "at least in this dataset", "paints a [adjective] picture", "hard numbers"
- Do NOT create sections titled "Open Questions", "Key Numbers", "Key Takeaways", or "Limitations"
- Return ONLY the revised article content, no explanation or commentary`,
      messages: [
        {
          role: "user",
          content: `Here is the current article:\n\n${data.generatedContent}\n\nPlease revise the article with these instructions:\n${feedback}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "Claude returned no text" }, { status: 500 });
    }

    const revisedContent = textBlock.text.trim();
    const wordCount = revisedContent.split(/\s+/).length;

    data.generatedContent = revisedContent;
    data.generatedWordCount = wordCount;
    data.updatedAt = Date.now();

    const actions = Array.isArray(data.actions) ? data.actions : [];
    actions.push({
      type: "article_improved",
      timestamp: Date.now(),
      details: feedback,
    });
    data.actions = actions;

    const patchRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
      method: "PATCH",
      headers: railwayHeaders(),
      body: JSON.stringify({ data, status: "generated" }),
    });

    if (!patchRes.ok) {
      const err = await patchRes.text();
      return Response.json({ error: `Update failed: ${err}` }, { status: 500 });
    }

    return Response.json({ ok: true, idea: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Article improve failed";
    console.error("Article improve error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
