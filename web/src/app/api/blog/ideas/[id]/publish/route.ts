import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  publishToGitHub,
  type TopicPlan,
} from "@/lib/blogGeneration";
import { generateTweet, postTweetThread, isTwitterConfigured } from "@/lib/twitter";

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

// POST — Publish a generated idea (cheap — just commits stored content to GitHub)
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

  if (!process.env.GITHUB_TOKEN) {
    return Response.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
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

  if (data.status !== "generated") {
    return Response.json({ error: "Idea must be in generated status to publish" }, { status: 400 });
  }
  if (!data.generatedContent) {
    return Response.json({ error: "No generated content found" }, { status: 400 });
  }

  // Build topic from stored fields
  const topic: TopicPlan = {
    title: data.title,
    slug: data.generatedSlug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    description: data.description,
    targetKeywords: data.targetKeywords || [],
    contentGap: data.contentGap || "",
    analysisQuestions: data.analysisQuestions || [],
  };

  try {
    // Publish stored content to GitHub (no-op send since this isn't streaming)
    const noop = () => {};
    const { isFirstPublish } = await publishToGitHub(topic, data.generatedContent, data.generatedWordCount || 0, noop);

    // Tweet on first publish only
    if (isFirstPublish && isTwitterConfigured()) {
      try {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (apiKey) {
          const client = new Anthropic({ apiKey });
          const tweets = await generateTweet(topic.title, topic.description, data.generatedContent, topic.slug, client);
          await postTweetThread(tweets.tweet1, tweets.tweet2);
        }
      } catch (tweetErr) {
        console.error("Tweet failed (non-blocking):", tweetErr);
      }
    } else if (isFirstPublish) {
      console.warn("Twitter not configured — skipping tweet for new post:", topic.slug);
    }

    // Update idea status in Railway
    data.status = "published";
    data.publishedSlug = topic.slug;
    data.updatedAt = Date.now();
    const actions = Array.isArray(data.actions) ? data.actions : [];
    actions.push({ type: "published", timestamp: Date.now() });
    data.actions = actions;

    await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${id}`, {
      method: "PATCH",
      headers: railwayHeaders(),
      body: JSON.stringify({ data, status: "published" }),
    });

    return Response.json({ ok: true, slug: topic.slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    console.error("Publish error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
