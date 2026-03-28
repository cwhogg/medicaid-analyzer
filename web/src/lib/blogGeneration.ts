import Anthropic from "@anthropic-ai/sdk";
import { validateSQL } from "@/lib/sqlValidation";
import { executeRemoteQuery } from "@/lib/railway";
import type { DatasetConfig } from "@/lib/datasets/index";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = "cwhogg";
const GITHUB_REPO = "medicaid-analyzer";

export interface AnalysisStep {
  question: string;
  sql: string;
  columns: string[];
  rows: unknown[][];
}

export interface TopicPlan {
  title: string;
  slug: string;
  description: string;
  targetKeywords: string[];
  contentGap: string;
  analysisQuestions: string[];
  provocativeAngle?: string;
}

export interface FactsObject {
  headline_finding: string;
  key_facts: string[];
  comparisons: string[];
  trend_direction: string;
  trend_magnitude: string | null;
  audience_hook: string;
  open_question: string;
}

// Stream newline-delimited JSON events back to the client
export function streamResponse(
  generator: (send: (event: Record<string, unknown>) => void) => Promise<void>
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await generator(send);
      } catch (err) {
        send({
          phase: "error",
          message: err instanceof Error ? err.message : "Internal server error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

// Phase 2: Run analysis queries
export async function runAnalyses(
  topic: TopicPlan,
  dsConfig: DatasetConfig,
  client: Anthropic,
  send: (event: Record<string, unknown>) => void
): Promise<AnalysisStep[]> {
  const schemaPrompt = dsConfig.generateSchemaPrompt();
  const analysisSteps: AnalysisStep[] = [];
  const totalQuestions = topic.analysisQuestions.length;

  for (let i = 0; i < totalQuestions; i++) {
    const question = topic.analysisQuestions[i];
    send({
      phase: "analysis",
      message: `Running analysis ${i + 1} of ${totalQuestions}...`,
      step: i + 1,
      total: totalQuestions,
      question,
    });

    try {
      const sqlResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        temperature: 0,
        system: [
          {
            type: "text" as const,
            text: `${dsConfig.systemPromptPreamble}\n\n${schemaPrompt}\n\n${dsConfig.systemPromptRules}\n\nAdditional rule for blog queries:\n- Always include a LIMIT clause (max 100 for blog data tables).`,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user", content: question }],
      });

      const sqlBlock = sqlResponse.content.find((b) => b.type === "text");
      if (!sqlBlock || sqlBlock.type !== "text") {
        send({
          phase: "analysis",
          message: `Analysis ${i + 1}: no SQL generated, skipping`,
          step: i + 1,
          total: totalQuestions,
          skipped: true,
        });
        continue;
      }

      let sql = sqlBlock.text.trim();
      if (sql.startsWith("```")) {
        sql = sql
          .replace(/^```(?:sql)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
      }
      if (sql.startsWith("CANNOT_ANSWER:")) {
        send({
          phase: "analysis",
          message: `Analysis ${i + 1}: cannot answer, skipping`,
          step: i + 1,
          total: totalQuestions,
          skipped: true,
        });
        continue;
      }

      const validation = validateSQL(sql);
      if (!validation.valid) {
        send({
          phase: "analysis",
          message: `Analysis ${i + 1}: invalid SQL, skipping`,
          step: i + 1,
          total: totalQuestions,
          skipped: true,
        });
        continue;
      }

      const result = await executeRemoteQuery(sql, dsConfig.key);
      analysisSteps.push({
        question,
        sql,
        columns: result.columns,
        rows: result.rows.slice(0, 50),
      });

      send({
        phase: "analysis",
        message: `Analysis ${i + 1} complete: ${result.rows.length} rows`,
        step: i + 1,
        total: totalQuestions,
        rows: result.rows.length,
      });
    } catch (err) {
      console.error(`Blog gen: query failed for "${question}":`, err);
      send({
        phase: "analysis",
        message: `Analysis ${i + 1} failed: ${err instanceof Error ? err.message : "unknown error"}`,
        step: i + 1,
        total: totalQuestions,
        skipped: true,
      });
    }
  }

  return analysisSteps;
}

// Phase 2.5: Extract verified facts from analysis results
export async function extractFacts(
  topic: TopicPlan,
  analysisSteps: AnalysisStep[],
  client: Anthropic,
  send: (event: Record<string, unknown>) => void
): Promise<FactsObject | null> {
  send({ phase: "facts", message: "Extracting verified facts..." });

  const dataSummary = analysisSteps
    .map((step, i) => {
      const header = step.columns.join(" | ");
      const rows = step.rows
        .slice(0, 20)
        .map((r) => r.map((v) => String(v ?? "")).join(" | "))
        .join("\n");
      return `### Analysis ${i + 1}: ${step.question}\nColumns: ${header}\n${rows}`;
    })
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0,
      system: `You are a facts extraction engine. Your ONLY job is to pull explicit numbers and findings from query results into a structured JSON object.

STRICT RULES:
- ONLY include numbers, percentages, and values that appear VERBATIM in the data tables provided
- Do NOT calculate, infer, interpolate, or estimate any values
- Do NOT round numbers differently than they appear in the data
- If a comparison is not explicitly in the data (e.g. year-over-year change), do NOT compute it
- If you cannot fill a field from the data, use null for nullable fields or "Unknown" for string fields
- Every number in key_facts and comparisons must be directly traceable to a cell in the provided data

Return a JSON object with these fields:
- headline_finding: The single most newsworthy finding (1 sentence, must contain a number from the data)
- key_facts: Array of 4-8 factual statements, each containing at least one number from the data
- comparisons: Array of 2-4 comparisons that are explicit in the data (e.g. "State A: X% vs State B: Y%")
- trend_direction: "increasing", "decreasing", "mixed", or "stable" (based on data, not inference)
- trend_magnitude: A specific number from the data showing the scale of change, or null if not available
- audience_hook: Why a healthcare analyst would care (1 sentence, referencing a specific number)
- open_question: One question the data raises but cannot answer (must reference a specific finding)

Return ONLY valid JSON, no markdown fences or explanation.`,
      messages: [
        {
          role: "user",
          content: `Extract verified facts for an article titled "${topic.title}" from these query results:\n\n${dataSummary}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      console.warn("Facts extraction returned no text");
      send({ phase: "facts", message: "Facts extraction returned no text, continuing without facts" });
      return null;
    }

    const cleaned = textBlock.text
      .replace(/^```(?:json)?\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    const facts: FactsObject = JSON.parse(cleaned);

    send({
      phase: "facts",
      message: "Facts extracted",
      headlineFinding: facts.headline_finding,
      factCount: facts.key_facts.length,
    });

    return facts;
  } catch (err) {
    console.warn("Facts extraction failed:", err instanceof Error ? err.message : err);
    send({ phase: "facts", message: "Facts extraction failed, continuing without facts" });
    return null;
  }
}

export interface TopTweetExample {
  tweet_text: string;
  impressions: number;
  likes: number;
  retweets: number;
  link_clicks: number;
  engagement_rate: number;
}

// Phase 3: Write the article
export async function writeArticle(
  topic: TopicPlan,
  analysisSteps: AnalysisStep[],
  dsConfig: DatasetConfig,
  client: Anthropic,
  send: (event: Record<string, unknown>) => void,
  facts: FactsObject | null = null,
  topTweets: TopTweetExample[] = []
): Promise<{ bodyContent: string; wordCount: number; tweet1: string; tweet2: string }> {
  send({
    phase: "writing",
    message: `Writing article from ${analysisSteps.length} analyses...`,
  });

  const dataSummary = analysisSteps
    .map((step, i) => {
      const header = step.columns.join(" | ");
      const rows = step.rows
        .slice(0, 20)
        .map((r) => r.map((v) => String(v ?? "")).join(" | "))
        .join("\n");
      return `### Analysis ${i + 1}: ${step.question}\nColumns: ${header}\n${rows}`;
    })
    .join("\n\n");

  const today = new Date().toISOString().split("T")[0];

  const writeResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    temperature: 0.3,
    system: `You are a senior data journalist at Open Health Data Hub. This article uses ${dsConfig.label} data. Your readers are healthcare policy researchers, analysts, and journalists.

## Your job
Turn the provided query results into a 650–850 word article that makes one clear point and supports it with real numbers. Write like a human reporter with a deadline, not an AI trying to be thorough.

## Structure — VARY IT
Do NOT follow the same structure every time. Pick ONE of these approaches and commit to it:
- Lead with the most surprising finding as a declarative statement, then build the case with data sections
- Open with a table that tells the whole story, then unpack it
- Start by contradicting a common assumption, then show the evidence
- Begin with two numbers that don't seem to go together, then explain why

Requirements:
- 2-3 analysis sections with descriptive ## headings
- End the article differently each time: a single unanswered question woven into prose, a callback to the opening, a surprising implication stated flatly, or just stop after the last finding. Do NOT always end with a numbered list of questions under "## Open Questions".

## Data rules
- ONLY cite numbers from the VERIFIED FACTS OBJECT (if provided). Every number, percentage, and dollar amount in your article must appear in the facts object. If no facts object is provided, only cite numbers from the raw query results.
- When you reference a number, give context (percentage change, rank, comparison).
- Maximum ONE table per article, ≤ 8 rows. If a sentence can say what the table says, cut the table.
- Do NOT explain what the dataset is. Never write "The BRFSS is a survey administered by..." — the audience knows.
- Mention sample size only for genuinely small samples (under 200). Otherwise trust the data.

## Interpretation framework — your most important job
The data tells us WHAT happened. Your job is to tell us WHY IT MATTERS. After every key finding, add 1-2 sentences explaining the human significance:
- What does this mean for real patients, providers, or taxpayers?
- How does this compare to what people assume?
- What would change if this trend continues?
Do NOT speculate about causes (no "this likely reflects..."). DO explain consequences and significance.

## Tone & style
- Write like Nate Silver or a sharp analyst at a research firm: precise, professional, and engaging. Confident but not flashy. Let the numbers carry the weight.
- Avoid colorful verbs and journalistic idioms (no "shed", "clawed back", "surged", "ballooned", "skyrocketed", "plummeted", "cratered"). Use precise, neutral verbs: "declined", "increased", "fell", "rose", "dropped", "grew", "recovered". The data is interesting enough without dramatic language.
- Short sentences mixed with longer ones. Active voice.
- Vary sentence openings — not every paragraph should start with "The [noun]...". Start with verbs, numbers, names, questions.
- Vary paragraph length. Some sections should be 1-2 sentences. Not everything needs 3 paragraphs of development.
- Use bold sparingly — only for the 1-2 most important numbers per section, not every number.
- NEVER use em dashes (—). Use commas, parentheses, periods, or colons instead.
- Contractions are fine. Jargon is fine if your audience knows it.
- H2 headings should read like newspaper headlines — specific and descriptive.

## STRICTLY BANNED — never use any of these
Phrases: "it's worth noting", "it should be noted", "interestingly", "notably", "importantly", "taken together", "the broader takeaway is", "what makes this finding particularly significant", "warrants further investigation", "warrants attention", "several patterns jump out", "several factors could explain", "one hypothesis:", "is worth isolating", "is worth flagging", "at least in this dataset", "the direction of causality here is", "paints a [adjective] picture", "hard numbers"
Dramatic verbs: "shed", "clawed back", "surged", "ballooned", "skyrocketed", "plummeted", "cratered", "hemorrhaged", "devoured", "swallowed", "exploded", "slashed" — use precise neutral verbs instead (declined, increased, fell, rose, dropped, grew, recovered)
Patterns: "whether that reflects X, Y, or Z is a question the data can't resolve" — never use this construction
Speculation: "this likely reflects...", "this may be driven by...", "one possible explanation is..."
Policy: "policymakers should...", "this has implications for...", "stakeholders must consider..."
Hedging: "while more research is needed...", "this interpretation requires significant caution", "although it is difficult to say..."
Generic openings: "In recent years...", "As healthcare costs continue to rise...", "In conclusion...", "[Dataset] has quietly become..."
Sections: Do NOT include a section titled "Open Questions", "Key Numbers", "Key Takeaways", "What These Findings Mean", or "Limitations"
Passive padding: "it can be seen that...", "there has been an increase in..."

## Formatting rules
- Use markdown with ## headings (never # — the title is rendered separately)
- Do NOT include the article title as an H1 or repeat it as the first heading
- Do NOT include frontmatter
- Keep paragraphs to 3-4 sentences max
- Prefer specific numbers over vague qualifiers ("rose 34%" not "rose significantly")

## Twitter thread (REQUIRED — include at the very end)
After the article, output a separator line "---TWEETS---" followed by exactly two lines:
- TWEET1: Under 250 chars. No hashtags, no links. Feature a specific surprising number from the VERIFIED FACTS OBJECT (if provided). Vary the format — sometimes lead with the number, sometimes lead with the implication, sometimes ask a question. Do NOT always use the "[stat] — [context]" format.
- TWEET2: The article title on its own line, then a blank line, then the bare URL with UTM tracking. Do NOT prefix with "Read more in this blog post:" — just the title and URL. Format: "{title}\n\nhttps://www.openhealthdatahub.com/blog/{slug}?utm_source=twitter&utm_medium=social&utm_campaign={slug}"

Example output format:
---TWEETS---
TWEET1: Every state that had an obesity rate below 25% in 2014 has now crossed that line. Colorado, the leanest, went from 21.3% to 25.0%.
TWEET2: Has Obesity Gotten Worse in Every State Since 2014?\n\nhttps://www.openhealthdatahub.com/blog/has-obesity-gotten-worse-in-every-state-since-2014?utm_source=twitter&utm_medium=social&utm_campaign=has-obesity-gotten-worse-in-every-state-since-2014${
      topTweets.length > 0
        ? `\n\n## TOP-PERFORMING TWEET EXAMPLES (learn from what worked)\nThese tweets got the highest engagement. Study their patterns:\n${topTweets
            .map(
              (t, i) =>
                `${i + 1}. "${t.tweet_text}" (${t.impressions.toLocaleString()} impressions, ${t.likes} likes, ${t.retweets} RTs, ${t.engagement_rate}% engagement)`
            )
            .join("\n")}`
        : ""
    }`,
    messages: [
      {
        role: "user",
        content: facts
          ? `Write a blog post titled "${topic.title}" (slug: "${topic.slug}").

## VERIFIED FACTS OBJECT
Use ONLY these pre-verified numbers in your article:
${JSON.stringify(facts, null, 2)}

## RAW QUERY RESULTS (for context only — do not cite numbers not in the facts object above)
${dataSummary}${topic.provocativeAngle ? `\n\n## Framing guidance\n${topic.provocativeAngle}` : ""}

Today's date: ${today}`
          : `NOTE: Facts extraction was unavailable. Be extra careful to only cite numbers that appear verbatim in the data below.

Write a blog post titled "${topic.title}" (slug: "${topic.slug}") using these real analysis results:

${dataSummary}${topic.provocativeAngle ? `\n\n## Framing guidance\n${topic.provocativeAngle}` : ""}

Today's date: ${today}`,
      },
    ],
  });

  const writeBlock = writeResponse.content.find((b) => b.type === "text");
  if (!writeBlock || writeBlock.type !== "text") {
    throw new Error("Blog writing returned no text");
  }

  const fullOutput = writeBlock.text.trim();

  // Split article from tweets
  let tweet1 = "";
  let tweet2 = "";

  const tweetSplit = fullOutput.split("---TWEETS---");
  const bodyContent = tweetSplit[0].trim();

  if (tweetSplit[1]) {
    const tweetLines = tweetSplit[1].trim().split("\n");
    let collectingTweet2 = false;
    const tweet2Lines: string[] = [];

    for (const line of tweetLines) {
      if (line.startsWith("TWEET1:")) {
        collectingTweet2 = false;
        tweet1 = line.replace("TWEET1:", "").trim();
      } else if (line.startsWith("TWEET2:")) {
        collectingTweet2 = true;
        tweet2Lines.push(line.replace("TWEET2:", "").trim());
      } else if (collectingTweet2) {
        // Capture URL that ends up on its own line
        tweet2Lines.push(line);
      }
    }

    // Handle both literal \n from Claude and actual newlines
    tweet2 = tweet2Lines.join("\n").replace(/\\n/g, "\n").trim();
    // Ensure blank line before URL so Twitter expands the link card
    if (tweet2 && tweet2.includes("https://") && !tweet2.includes("\n\nhttps://")) {
      tweet2 = tweet2.replace(/\n?(https:\/\/)/, "\n\n$1");
    }
  }

  const wordCount = bodyContent.split(/\s+/).length;

  send({
    phase: "writing",
    message: `Article written: ${wordCount} words`,
    wordCount,
  });

  return { bodyContent, wordCount, tweet1, tweet2 };
}

// Phase 4: Publish to GitHub
export async function publishToGitHub(
  topic: TopicPlan,
  content: string,
  wordCount: number,
  send: (event: Record<string, unknown>) => void
): Promise<{ isFirstPublish: boolean }> {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  send({ phase: "publishing", message: "Committing to GitHub..." });

  const filePath = `content/blog/${topic.slug}.md`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };

  // Check if file already exists (for re-publish: preserve original date, provide sha)
  let existingSha: string | undefined;
  let publishDate = new Date().toISOString();

  try {
    const existingRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      { headers: ghHeaders }
    );
    if (existingRes.ok) {
      const existing = await existingRes.json();
      existingSha = existing.sha;
      // Extract original date from existing frontmatter
      const decoded = Buffer.from(existing.content, "base64").toString("utf-8");
      const dateMatch = decoded.match(/^date:\s*"(.+?)"/m);
      if (dateMatch) {
        publishDate = dateMatch[1];
      }
    }
  } catch {
    // File doesn't exist yet — use current date
  }

  const frontmatter = `---
title: "${topic.title.replace(/"/g, '\\"')}"
type: blog-post
targetKeywords: ${JSON.stringify(topic.targetKeywords)}
contentGap: "${topic.contentGap.replace(/"/g, '\\"')}"
date: "${publishDate}"
description: "${topic.description.replace(/"/g, '\\"')}"
ideaName: "Open Health Data Hub"
status: published
wordCount: ${wordCount}
canonicalUrl: "https://www.openhealthdatahub.com/blog/${topic.slug}"
---

${content}
`;

  const contentBase64 = Buffer.from(frontmatter).toString("base64");

  const putBody: Record<string, unknown> = {
    message: existingSha ? `Update blog post: ${topic.title}` : `Add blog post: ${topic.title}`,
    content: contentBase64,
    branch: "main",
  };
  if (existingSha) {
    putBody.sha = existingSha;
  }

  const ghResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: ghHeaders,
      body: JSON.stringify(putBody),
    }
  );

  if (!ghResponse.ok) {
    const ghError = await ghResponse.text();
    console.error("GitHub API error:", ghError);
    throw new Error(`GitHub commit failed (${ghResponse.status}): ${ghError.slice(0, 200)}`);
  }

  return { isFirstPublish: !existingSha };
}

// Audit: check that all numbers in the article appear in the facts object
export function auditArticleNumbers(
  article: string,
  facts: FactsObject | null
): string[] {
  if (!facts) return [];

  // Extract all numbers from the facts JSON
  const factsText = JSON.stringify(facts);
  const factsNumbers = new Set<string>();
  const numberPattern = /\d[\d,]*\.?\d*/g;
  let match;
  while ((match = numberPattern.exec(factsText)) !== null) {
    factsNumbers.add(match[0].replace(/,/g, ""));
  }

  // Extract all numbers from the article
  const articleNumbers: string[] = [];
  const articlePattern = /\d[\d,]*\.?\d*%?/g;
  while ((match = articlePattern.exec(article)) !== null) {
    const raw = match[0].replace(/%$/, "").replace(/,/g, "");
    // Filter out common false positives
    const num = parseFloat(raw);
    if (isNaN(num)) continue;
    // Skip years 2013-2030
    if (num >= 2013 && num <= 2030 && Number.isInteger(num)) continue;
    // Skip single digits 0-9
    if (num >= 0 && num <= 9 && Number.isInteger(num)) continue;
    articleNumbers.push(raw);
  }

  // Find numbers in the article that aren't in the facts
  const unmatched = articleNumbers.filter((n) => !factsNumbers.has(n));

  // Deduplicate
  return Array.from(new Set(unmatched));
}

// Wait for Vercel deployment to make the blog page live before tweeting
export async function waitForLivePage(slug: string, timeoutMs = 120000): Promise<boolean> {
  const url = `https://www.openhealthdatahub.com/blog/${slug}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (res.ok) return true;
    } catch {
      // Network error, keep trying
    }
  }

  return false;
}
