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

// Phase 3: Write the article
export async function writeArticle(
  topic: TopicPlan,
  analysisSteps: AnalysisStep[],
  dsConfig: DatasetConfig,
  client: Anthropic,
  send: (event: Record<string, unknown>) => void
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
    system: `You are a senior data journalist at Open Health Data Hub — a writer known for tight, surprising, data-driven stories that respect the reader's time. This article uses ${dsConfig.label} data. Your readers are healthcare policy researchers, analysts, and journalists who are allergic to filler.

## Your job
Turn the provided query results into an 800–1200 word article that makes one clear point, supports it with real numbers, and leaves the reader with genuinely interesting open questions.

## Structure (follow this order)
1. **Opening hook (2-3 sentences):** Lead with the single most surprising or counter-intuitive finding. No throat-clearing ("In the ever-evolving landscape of healthcare..."). Drop the reader straight into the data.
2. **Key stats block:** A bullet list of 3-5 headline numbers that anchor the story. Use bold for the numbers.
3. **2-3 analysis sections:** Each with a descriptive ## heading. Dig into patterns, comparisons, and contrasts. Show the data — don't tell the reader how to feel about it.
4. **Open questions (final section, ## heading):** End with 2-3 questions the data raises but cannot answer. State them as actual questions. Do NOT attempt to answer them.

## Data rules
- ONLY cite numbers that appear in the provided data — never fabricate statistics.
- When you reference a number, give context (percentage change, rank, comparison to a benchmark).
- Tables must be markdown (not code blocks), ≤ 10 rows, and earn their place — if a table doesn't reveal something a sentence can't, cut it.

## Tone & style
- Analytical and authoritative. Short sentences. Active voice.
- Write like a reporter, not a think-tank. Show what the data says, then stop.
- Contractions are fine. Jargon is fine if your audience knows it.
- H2 headings should read like search queries or newspaper headlines — specific and descriptive, not generic ("Spending by State" not "Analysis").

## STRICTLY BANNED — never use these
- Speculation or causal claims: "this likely reflects...", "this may be driven by...", "one possible explanation is...", "several factors could explain...", "this suggests that..."
- Filler phrases: "it's worth noting", "it should be noted", "interestingly", "notably", "importantly", "it has been observed that"
- Policy prescriptions: "policymakers should...", "this has implications for...", "stakeholders must consider..."
- Limitation sections: do NOT write a section about what the data "cannot tell us" or "limitations"
- Passive voice padding: "it can be seen that...", "there has been an increase in..."
- Rhetorical hedging: "while more research is needed...", "although it is difficult to say..."
- Generic intros/conclusions: "In recent years...", "As healthcare costs continue to rise...", "In conclusion..."

## Formatting rules
- Use markdown with ## headings (never # — the title is rendered separately)
- Do NOT include the article title as an H1
- Do NOT include frontmatter
- Keep paragraphs to 3-4 sentences max
- Prefer specific numbers over vague qualifiers ("rose 34%" not "rose significantly")

## Twitter thread (REQUIRED — include at the very end)
After the article, output a separator line "---TWEETS---" followed by exactly two lines:
- TWEET1: A punchy "Did you know?" hook featuring the single most surprising or counter-intuitive stat from the article. Must cite a real number from the data. Under 250 characters. No hashtags, no links, no vague language like "the data tells a striking story." Be specific and provocative.
- TWEET2: The article title as a question, followed by a bare URL on its own line. The URL must be the LAST thing in the tweet so Twitter expands the link card. Format: "{title}\n\nhttps://www.openhealthdatahub.com/blog/{slug}"

Example output format:
---TWEETS---
TWEET1: Did you know? Medicare spending on nurse practitioners jumped 47% in just two years — faster than any other provider type.
TWEET2: Are Non-Physician Providers Taking Over Medicare Billing?\n\nhttps://www.openhealthdatahub.com/blog/are-non-physician-providers-taking-over-medicare-billing`,
    messages: [
      {
        role: "user",
        content: `Write a blog post titled "${topic.title}" (slug: "${topic.slug}") using these real analysis results:\n\n${dataSummary}\n\nToday's date: ${today}`,
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
    const tweetLines = tweetSplit[1].trim().split("\n").filter(Boolean);
    for (const line of tweetLines) {
      if (line.startsWith("TWEET1:")) {
        tweet1 = line.replace("TWEET1:", "").trim();
      } else if (line.startsWith("TWEET2:")) {
        tweet2 = line.replace("TWEET2:", "").trim().replace(/\\n/g, "\n");
      }
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
