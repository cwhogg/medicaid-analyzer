import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDataset, getAllDatasets } from "@/lib/datasets/index";
import { getAllPosts } from "@/lib/content";

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

// GET — List ideas, proxy to Railway
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RAILWAY_QUERY_URL) {
    return Response.json({ error: "RAILWAY_QUERY_URL not configured" }, { status: 500 });
  }

  const status = request.nextUrl.searchParams.get("status") || "";
  const url = status
    ? `${RAILWAY_QUERY_URL}/blog-ideas?status=${encodeURIComponent(status)}`
    : `${RAILWAY_QUERY_URL}/blog-ideas`;

  const res = await fetch(url, { headers: railwayHeaders() });
  const data = await res.json();
  return Response.json(data, { status: res.status });
}

// POST — Generate 5-8 ideas via Claude
export async function POST(request: NextRequest) {
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

  let datasetKey = "medicaid";
  try {
    const body = await request.json();
    if (body.dataset && typeof body.dataset === "string") {
      const validKeys = getAllDatasets().map((d) => d.key);
      if (validKeys.includes(body.dataset)) {
        datasetKey = body.dataset;
      }
    }
  } catch {
    // No body — use default dataset
  }

  const dsConfig = getDataset(datasetKey);
  const client = new Anthropic({ apiKey });
  const schemaPrompt = dsConfig.generateSchemaPrompt();

  // Get existing titles (published posts + pending ideas) to avoid duplication
  let existingTitles: string[] = [];
  try {
    existingTitles = getAllPosts("blog").map((p) => p.frontmatter.title);
  } catch {
    // content dir may not exist on Vercel
  }

  // Also fetch pending/improved ideas from Railway
  try {
    const pendingRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas`, {
      headers: railwayHeaders(),
    });
    if (pendingRes.ok) {
      const pendingData = await pendingRes.json();
      const pendingIdeas = pendingData.ideas || [];
      for (const idea of pendingIdeas) {
        if (idea.data?.title && idea.status !== "deleted") {
          existingTitles.push(idea.data.title);
        }
      }
    }
  } catch {
    // Non-critical
  }

  const systemPrompt = `You generate blog post ideas for a public health data analysis site called Open Health Data Hub. You are generating ideas for the ${dsConfig.label} dataset. ${dsConfig.pageSubtitle}.

CRITICAL: Your analysisQuestions MUST be answerable using ONLY the columns listed in the schema below. Do NOT propose questions about data that isn't in the schema.

${schemaPrompt}

Generate 5-8 distinct blog post ideas. Each idea should have:
- title: SEO-optimized article title (50-70 chars)
- description: Brief summary of what the article will cover (1-2 sentences)
- targetKeywords: array of 3-5 SEO keywords
- contentGap: what gap this content fills (1 sentence)
- analysisQuestions: array of 2-3 specific analytical questions to investigate using SQL queries against the dataset (MUST use only columns from the schema above)

Return a JSON array of idea objects. Return ONLY valid JSON, no markdown fences or explanation.`;

  const userMessage = `Generate 5-8 novel ${dsConfig.label} data analysis blog post ideas. Each idea should explore a different angle or topic.

Existing titles to avoid overlap with:
${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return Response.json({ error: "Claude returned no text" }, { status: 500 });
    }

    let ideas: Array<{
      title: string;
      description: string;
      targetKeywords: string[];
      contentGap: string;
      analysisQuestions: string[];
    }>;
    try {
      const cleaned = textBlock.text
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      ideas = JSON.parse(cleaned);
    } catch {
      return Response.json(
        { error: "Claude returned invalid JSON", raw: textBlock.text },
        { status: 500 }
      );
    }

    if (!Array.isArray(ideas) || ideas.length === 0) {
      return Response.json({ error: "No ideas generated" }, { status: 500 });
    }

    const now = Date.now();
    const ideasToSave = ideas.map((idea) => {
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
      const fullIdea = {
        id,
        title: idea.title,
        description: idea.description,
        dataset: datasetKey,
        targetKeywords: idea.targetKeywords,
        contentGap: idea.contentGap,
        analysisQuestions: idea.analysisQuestions,
        status: "pending" as const,
        createdAt: now,
        updatedAt: now,
        actions: [{ type: "created", timestamp: now }],
      };
      return {
        id,
        status: "pending",
        data: JSON.stringify(fullIdea),
      };
    });

    // Save to Railway
    const saveRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({ ideas: ideasToSave }),
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      return Response.json(
        { error: `Failed to save ideas: ${err}` },
        { status: 500 }
      );
    }

    // Return the full idea objects for the UI
    const savedIdeas = ideasToSave.map((i) => JSON.parse(i.data));
    return Response.json({ ideas: savedIdeas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate ideas";
    console.error("Idea generation error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
