import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDataset, getAllDatasets } from "@/lib/datasets/index";
import { getAllPosts } from "@/lib/content";
import {
  streamResponse,
  runAnalyses,
  writeArticle,
  publishToGitHub,
  type TopicPlan,
} from "@/lib/blogGeneration";

export const maxDuration = 300;

const ADMIN_SECRET = process.env.ADMIN_API_KEY;

export async function POST(request: NextRequest) {
  // Auth
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  if (!process.env.GITHUB_TOKEN) {
    return Response.json(
      { error: "GITHUB_TOKEN not configured" },
      { status: 500 }
    );
  }

  // Parse optional topic and dataset from request body
  let userTopic: string | null = null;
  let datasetKey = "medicaid";
  try {
    const body = await request.json();
    if (body.topic && typeof body.topic === "string" && body.topic.trim()) {
      userTopic = body.topic.trim();
    }
    if (body.dataset && typeof body.dataset === "string") {
      const validKeys = getAllDatasets().map((d) => d.key);
      if (validKeys.includes(body.dataset)) {
        datasetKey = body.dataset;
      }
    }
  } catch {
    // No body or invalid JSON — that's fine, Claude will choose the topic
  }

  return streamResponse(async (send) => {
    const start = Date.now();
    const client = new Anthropic({ apiKey });
    const dsConfig = getDataset(datasetKey);

    // Get existing post titles to avoid repetition
    let existingTitles: string[] = [];
    try {
      existingTitles = getAllPosts("blog").map((p) => p.frontmatter.title);
    } catch {
      // On Vercel runtime, content dir may not exist — that's fine
    }

    // --- Phase 1: Topic Generation ---
    send({
      phase: "topic",
      message: userTopic
        ? `Planning post for: "${userTopic}"`
        : "Generating topic...",
    });

    const schemaPrompt = dsConfig.generateSchemaPrompt();

    const topicSystemPrompt = `You generate SEO-optimized blog post plans for a public health data analysis site called Open Health Data Hub. You are writing about the ${dsConfig.label} dataset. ${dsConfig.pageSubtitle}.

CRITICAL: Your analysisQuestions MUST be answerable using ONLY the columns listed in the schema below. Do NOT propose questions about data that isn't in the schema.

${schemaPrompt}

You must return a JSON object with these fields:
- title: SEO-optimized article title (50-70 chars)
- slug: URL-friendly slug (lowercase, hyphens)
- description: Meta description for SEO (120-160 chars)
- targetKeywords: array of 3-5 SEO keywords
- contentGap: what gap this content fills
- analysisQuestions: array of 2-3 specific analytical questions to investigate using SQL queries against the dataset (MUST use only columns from the schema above)

Return ONLY valid JSON, no markdown fences or explanation.`;

    const topicUserMessage = userTopic
      ? `Create a blog post plan about this topic: "${userTopic}"\n\nGenerate an SEO-optimized title, slug, keywords, and 2-3 specific data analysis questions that can be answered with SQL queries against the ${dsConfig.label} dataset.\n\nExisting posts to avoid overlap with:\n${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}`
      : `Generate a novel ${dsConfig.label} data analysis topic. Avoid topics already covered:\n${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}`;

    const topicResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: userTopic ? 0.3 : 0.7,
      system: topicSystemPrompt,
      messages: [{ role: "user", content: topicUserMessage }],
    });

    const topicText = topicResponse.content.find((b) => b.type === "text");
    if (!topicText || topicText.type !== "text") {
      send({ phase: "error", message: "Topic generation returned no text" });
      return;
    }

    let topic: TopicPlan;
    try {
      const cleaned = topicText.text
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      topic = JSON.parse(cleaned);
    } catch {
      send({
        phase: "error",
        message: "Topic generation returned invalid JSON",
        raw: topicText.text,
      });
      return;
    }

    send({
      phase: "topic",
      message: `Topic: ${topic.title}`,
      title: topic.title,
      slug: topic.slug,
      questions: topic.analysisQuestions.length,
    });

    // --- Phase 2: Analysis Execution ---
    const analysisSteps = await runAnalyses(topic, dsConfig, client, send);

    if (analysisSteps.length === 0) {
      send({ phase: "error", message: "All analysis queries failed" });
      return;
    }

    // --- Phase 3: Blog Writing ---
    const { bodyContent, wordCount } = await writeArticle(
      topic,
      analysisSteps,
      dsConfig,
      client,
      send
    );

    // --- Phase 4: Publish via GitHub ---
    await publishToGitHub(topic, bodyContent, wordCount, send);

    send({
      phase: "done",
      message: "Published!",
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      wordCount,
      analysisSteps: analysisSteps.length,
      generationMs: Date.now() - start,
    });
  });
}
