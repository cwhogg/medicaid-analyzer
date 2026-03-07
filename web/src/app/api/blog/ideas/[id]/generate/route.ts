import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDataset } from "@/lib/datasets/index";
import {
  streamResponse,
  runAnalyses,
  writeArticle,
  type TopicPlan,
} from "@/lib/blogGeneration";

export const maxDuration = 300;

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

// POST — Generate article content (the expensive operation)
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

  // Fetch idea from Railway
  const getRes = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
    headers: railwayHeaders(),
  });
  if (!getRes.ok) {
    return Response.json({ error: "Idea not found" }, { status: 404 });
  }
  const { idea } = await getRes.json();
  const data = idea.data || {};

  if (data.status !== "queued") {
    return Response.json({ error: "Idea must be in queued status to generate" }, { status: 400 });
  }

  // Build topic from idea
  const slugBase = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const topic: TopicPlan = {
    title: data.title,
    slug: slugBase,
    description: data.description,
    targetKeywords: data.targetKeywords || [],
    contentGap: data.contentGap || "",
    analysisQuestions: data.analysisQuestions || [],
  };

  const dataset = data.dataset || "medicaid";
  const dsConfig = getDataset(dataset);
  const client = new Anthropic({ apiKey });

  return streamResponse(async (send) => {
    const start = Date.now();

    send({
      phase: "topic",
      message: `Generating: ${topic.title}`,
      title: topic.title,
      slug: topic.slug,
      questions: topic.analysisQuestions.length,
    });

    // Phase 2: Analysis
    const analysisSteps = await runAnalyses(topic, dsConfig, client, send);

    if (analysisSteps.length === 0) {
      send({ phase: "error", message: "All analysis queries failed" });
      return;
    }

    // Phase 3: Writing
    const { bodyContent, wordCount } = await writeArticle(
      topic,
      analysisSteps,
      dsConfig,
      client,
      send
    );

    // Store generated content in Railway
    data.status = "generated";
    data.generatedContent = bodyContent;
    data.generatedSlug = topic.slug;
    data.generatedWordCount = wordCount;
    data.generatedAt = Date.now();
    data.updatedAt = Date.now();
    const actions = Array.isArray(data.actions) ? data.actions : [];
    actions.push({ type: "generated", timestamp: Date.now() });
    data.actions = actions;

    try {
      await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
        method: "PATCH",
        headers: railwayHeaders(),
        body: JSON.stringify({ data, status: "generated" }),
      });
    } catch {
      send({ phase: "error", message: "Failed to save generated content" });
      return;
    }

    send({
      phase: "done",
      message: "Generated!",
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      wordCount,
      analysisSteps: analysisSteps.length,
      generationMs: Date.now() - start,
    });
  });
}
