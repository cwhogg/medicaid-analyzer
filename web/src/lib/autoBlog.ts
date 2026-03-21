import Anthropic from "@anthropic-ai/sdk";
import { getDataset, getAllDatasets } from "@/lib/datasets/index";
import { getAllPosts } from "@/lib/content";
import {
  runAnalyses,
  extractFacts,
  writeArticle,
  auditArticleNumbers,
  publishToGitHub,
  waitForLivePage,
  type TopicPlan,
  type TopTweetExample,
} from "@/lib/blogGeneration";
import { postTweetThread, isTwitterConfigured } from "@/lib/twitter";

const RAILWAY_QUERY_URL = process.env.RAILWAY_QUERY_URL;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY;

function railwayHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (RAILWAY_API_KEY) {
    headers["Authorization"] = `Bearer ${RAILWAY_API_KEY}`;
  }
  return headers;
}

// --- Persona definitions ---

interface Persona {
  name: string;
  guidance: string;
  tweetStyle: string;
}

const PERSONAS: Persona[] = [
  {
    name: "viral",
    guidance:
      "Generate ideas optimized for social sharing. Look for surprising statistics, counterintuitive findings, or dramatic changes over time. The ideal post makes someone say 'I had no idea' and immediately share it. Favor comparisons (state vs state, before vs after, expected vs actual).",
    tweetStyle: "punchy and surprising, leading with the most shareable number",
  },
  {
    name: "analyst",
    guidance:
      "Generate ideas for a data-literate audience. Look for methodologically interesting patterns, unexpected correlations, or findings that challenge conventional wisdom. The ideal post would be discussed in a health policy newsletter or data science Slack channel.",
    tweetStyle: "precise and understated, letting an unusual finding speak for itself",
  },
  {
    name: "public-health",
    guidance:
      "Generate ideas about changes that affect real people's health. Look for trends in access to care, disease burden, health equity, or spending that signal meaningful shifts in population health. The ideal post helps a non-expert understand something important about how healthcare is changing.",
    tweetStyle: "accessible and human-centered, connecting data to real-world impact",
  },
];

// 7-day dataset rotation (coprime with 3-day persona cycle = 21-day full cycle)
const DATASET_ROTATION = [
  "medicaid",
  "medicare",
  "brfss",
  "nhanes",
  "medicare-inpatient",
  "medicare-partd",
  "dac",
];

// --- Date-based rotation ---

function daysSinceEpoch(date: Date): number {
  return Math.floor(date.getTime() / 86400000);
}

export function getPersonaForDate(date: Date): Persona {
  return PERSONAS[daysSinceEpoch(date) % 3];
}

export function getDatasetForDate(date: Date): string {
  return DATASET_ROTATION[daysSinceEpoch(date) % 7];
}

// --- Idempotency check ---

async function checkAlreadyPublishedToday(dateStr: string): Promise<boolean> {
  if (!RAILWAY_QUERY_URL) return false;

  try {
    const res = await fetch(`${RAILWAY_QUERY_URL}/blog-ideas`, {
      headers: railwayHeaders(),
    });
    if (!res.ok) return false;

    const data = await res.json();
    const ideas = data.ideas || [];
    return ideas.some(
      (idea: { data?: { autoPublishDate?: string } }) =>
        idea.data?.autoPublishDate === dateStr
    );
  } catch {
    return false;
  }
}

// --- Idea generation + ranking ---

async function generateAndRankIdeas(
  persona: Persona,
  datasetKey: string,
  existingTitles: string[],
  client: Anthropic
): Promise<TopicPlan> {
  const dsConfig = getDataset(datasetKey);
  const schemaPrompt = dsConfig.generateSchemaPrompt();

  const systemPrompt = `You generate blog post ideas for a public health data analysis site called Open Health Data Hub. You are generating ideas for the ${dsConfig.label} dataset. ${dsConfig.pageSubtitle}.

EDITORIAL DIRECTION: ${persona.guidance}

CRITICAL: Your analysisQuestions MUST be answerable using ONLY the columns listed in the schema below. Do NOT propose questions about data that isn't in the schema.

${schemaPrompt}

Generate exactly 5 distinct blog post ideas. Each idea should have:
- title: Pick ONE of these approaches: (1) A surprising question that challenges assumptions ("Are Rural Hospitals Actually More Expensive?"), (2) A declarative finding that stops scrolling ("The $4 Billion Procedure Nobody Talks About"), (3) A contradiction that demands explanation ("Medicare Spending Dropped, But Patients Got Sicker"). 50-70 chars. Never use colon-separated labels like "Topic: Subtitle".
- description: 2-3 sentences structured as: (1) The surprising finding the data will reveal, (2) Why a healthcare analyst or journalist should care, (3) The tension or unanswered question that makes this worth reading.
- provocativeAngle: One sentence describing the "so what" — the implication that makes a reader stop scrolling. This should be the interpretive lens for the article, not just a restatement of the data.
- targetKeywords: array of 3-5 SEO keywords
- contentGap: what gap this content fills (1 sentence)
- analysisQuestions: array of 2-3 specific analytical questions to investigate using SQL queries against the dataset (MUST use only columns from the schema above)

Return a JSON array of idea objects. Return ONLY valid JSON, no markdown fences or explanation.`;

  const userMessage = `Generate exactly 5 novel ${dsConfig.label} data analysis blog post ideas. Each idea should explore a different angle or topic.

Existing titles to avoid overlap with:
${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Idea generation returned no text");
  }

  const cleaned = textBlock.text
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  const ideas = JSON.parse(cleaned);

  if (!Array.isArray(ideas) || ideas.length === 0) {
    throw new Error("No ideas generated");
  }

  // Ask Claude to rank and pick the best idea
  const rankResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    temperature: 0,
    system: `You rank blog post ideas. Pick the single best idea from the list based on: (1) how compelling the title is, (2) whether the analysis questions will yield interesting data, (3) shareability. Return ONLY the zero-based index number of the best idea (e.g. "2"). No explanation.`,
    messages: [
      {
        role: "user",
        content: `Pick the best idea:\n${ideas.map((idea: { title: string; description: string }, i: number) => `${i}. ${idea.title}: ${idea.description}`).join("\n")}`,
      },
    ],
  });

  const rankBlock = rankResponse.content.find((b) => b.type === "text");
  let bestIndex = 0;
  if (rankBlock && rankBlock.type === "text") {
    const parsed = parseInt(rankBlock.text.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < ideas.length) {
      bestIndex = parsed;
    }
  }

  const best = ideas[bestIndex];
  const slug = best.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    title: best.title,
    slug,
    description: best.description,
    targetKeywords: best.targetKeywords || [],
    contentGap: best.contentGap || "",
    analysisQuestions: best.analysisQuestions || [],
    provocativeAngle: best.provocativeAngle || undefined,
  };
}

// --- Main pipeline ---

export async function runDailyBlogPipeline(): Promise<{
  skipped: boolean;
  slug?: string;
  persona?: string;
  dataset?: string;
  title?: string;
  error?: string;
}> {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // e.g. "2026-03-13"

  // 1. Idempotency check
  const alreadyDone = await checkAlreadyPublishedToday(dateStr);
  if (alreadyDone) {
    return { skipped: true };
  }

  // 2. Select persona and dataset
  const persona = getPersonaForDate(now);
  const datasetKey = getDatasetForDate(now);

  // Validate dataset exists
  const validKeys = getAllDatasets().map((d) => d.key);
  if (!validKeys.includes(datasetKey)) {
    return { skipped: false, error: `Invalid dataset: ${datasetKey}` };
  }

  const dsConfig = getDataset(datasetKey);

  // Check env vars
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { skipped: false, error: "ANTHROPIC_API_KEY not configured" };
  }
  if (!RAILWAY_QUERY_URL) {
    return { skipped: false, error: "RAILWAY_QUERY_URL not configured" };
  }
  if (!process.env.GITHUB_TOKEN) {
    return { skipped: false, error: "GITHUB_TOKEN not configured" };
  }

  const client = new Anthropic({ apiKey });

  // Collect existing titles to avoid duplication
  let existingTitles: string[] = [];
  try {
    existingTitles = getAllPosts("blog").map((p) => p.frontmatter.title);
  } catch {
    // content dir may not exist on Vercel
  }

  // Also fetch pending/published ideas from Railway
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

  try {
    // 3-4. Generate ideas and pick the best one
    const topic = await generateAndRankIdeas(persona, datasetKey, existingTitles, client);

    // 5. Save idea to Railway
    const ideaId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const ideaData = {
      id: ideaId,
      title: topic.title,
      slug: topic.slug,
      description: topic.description,
      dataset: datasetKey,
      targetKeywords: topic.targetKeywords,
      contentGap: topic.contentGap,
      analysisQuestions: topic.analysisQuestions,
      provocativeAngle: topic.provocativeAngle,
      status: "queued",
      autoPersona: persona.name,
      autoPublishDate: dateStr,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      actions: [{ type: "auto_created", timestamp: Date.now(), persona: persona.name, dataset: datasetKey }] as Record<string, unknown>[],
    };

    await fetch(`${RAILWAY_QUERY_URL}/blog-ideas`, {
      method: "POST",
      headers: railwayHeaders(),
      body: JSON.stringify({
        ideas: [{ id: ideaId, status: "queued", data: JSON.stringify(ideaData) }],
      }),
    });

    // 6. Generate article (analyses -> facts -> writing -> audit)
    const noop = () => {};

    const analysisSteps = await runAnalyses(topic, dsConfig, client, noop);
    if (analysisSteps.length === 0) {
      // Update idea with failure
      ideaData.status = "failed";
      ideaData.updatedAt = Date.now();
      await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${ideaId}`, {
        method: "PATCH",
        headers: railwayHeaders(),
        body: JSON.stringify({ data: ideaData, status: "failed" }),
      });
      return { skipped: false, persona: persona.name, dataset: datasetKey, error: "All analysis queries failed" };
    }

    const facts = await extractFacts(topic, analysisSteps, client, noop);

    // Fetch top-performing tweets for prompt context
    let topTweets: TopTweetExample[] = [];
    try {
      const topRes = await fetch(`${RAILWAY_QUERY_URL}/tweet-metrics/top?limit=5`, {
        headers: railwayHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      if (topRes.ok) {
        const topData = await topRes.json();
        topTweets = (topData.tweets || []).map((t: Record<string, unknown>) => ({
          tweet_text: t.tweet_text || "",
          impressions: Number(t.impressions) || 0,
          likes: Number(t.likes) || 0,
          retweets: Number(t.retweets) || 0,
          link_clicks: Number(t.link_clicks) || 0,
          engagement_rate: Number(t.engagement_rate) || 0,
        }));
      }
    } catch {
      // Non-critical — continue without top tweets
    }

    const { bodyContent, wordCount, tweet1, tweet2 } = await writeArticle(
      topic,
      analysisSteps,
      dsConfig,
      client,
      noop,
      facts,
      topTweets
    );

    // Audit numbers (log only, don't block)
    const unmatchedNumbers = auditArticleNumbers(bodyContent, facts);
    if (unmatchedNumbers.length > 0) {
      console.warn(`Auto blog audit: ${unmatchedNumbers.length} unmatched number(s):`, unmatchedNumbers);
    }

    // 7. Publish to GitHub
    await publishToGitHub(topic, bodyContent, wordCount, noop);

    // 8. Wait for page to go live
    const isLive = await waitForLivePage(topic.slug);
    if (!isLive) {
      console.warn("Auto blog: page not live after 2min, continuing anyway:", topic.slug);
    }

    // 9. Tweet thread
    if (tweet1 && tweet2 && isTwitterConfigured()) {
      try {
        const { tweetId, replyId } = await postTweetThread(tweet1, tweet2);
        (ideaData as Record<string, unknown>).tweetId = tweetId;
        (ideaData as Record<string, unknown>).tweetReplyId = replyId;
      } catch (tweetErr) {
        console.error("Auto blog tweet failed (non-blocking):", tweetErr);
      }
    }

    // 10. Mark as published in Railway
    ideaData.status = "published";
    ideaData.updatedAt = Date.now();
    (ideaData as Record<string, unknown>).generatedContent = bodyContent;
    (ideaData as Record<string, unknown>).generatedSlug = topic.slug;
    (ideaData as Record<string, unknown>).generatedWordCount = wordCount;
    (ideaData as Record<string, unknown>).generatedTweet1 = tweet1;
    (ideaData as Record<string, unknown>).generatedTweet2 = tweet2;
    (ideaData as Record<string, unknown>).generatedFacts = facts;
    (ideaData as Record<string, unknown>).publishedSlug = topic.slug;
    ideaData.actions.push({ type: "auto_published", timestamp: Date.now() });

    await fetch(`${RAILWAY_QUERY_URL}/blog-ideas/${ideaId}`, {
      method: "PATCH",
      headers: railwayHeaders(),
      body: JSON.stringify({ data: ideaData, status: "published" }),
    });

    return {
      skipped: false,
      slug: topic.slug,
      persona: persona.name,
      dataset: datasetKey,
      title: topic.title,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Auto blog pipeline error:", message);
    return { skipped: false, persona: persona.name, dataset: datasetKey, error: message };
  }
}
