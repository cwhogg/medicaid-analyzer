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
): Promise<{ bodyContent: string; wordCount: number }> {
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
    system: `You are a data journalist writing for a public health data analysis blog called Open Health Data Hub. This article is about ${dsConfig.label} data. Write engaging, authoritative articles backed by real data. Your audience includes healthcare policy researchers, analysts, and journalists.

Rules:
- Write 1500-2500 words
- Use markdown formatting with ## and ### headings
- Include data as markdown tables (not code blocks)
- ONLY cite numbers that appear in the provided data — never fabricate statistics
- Start with an engaging introduction that frames why this analysis matters
- End with key takeaways
- Use an analytical, authoritative tone — not promotional
- Do NOT include the article title as an H1 — it will be rendered separately
- Do NOT include frontmatter — it will be added separately`,
    messages: [
      {
        role: "user",
        content: `Write a blog post titled "${topic.title}" using these real analysis results:\n\n${dataSummary}\n\nToday's date: ${today}`,
      },
    ],
  });

  const writeBlock = writeResponse.content.find((b) => b.type === "text");
  if (!writeBlock || writeBlock.type !== "text") {
    throw new Error("Blog writing returned no text");
  }

  const bodyContent = writeBlock.text.trim();
  const wordCount = bodyContent.split(/\s+/).length;

  send({
    phase: "writing",
    message: `Article written: ${wordCount} words`,
    wordCount,
  });

  return { bodyContent, wordCount };
}

// Phase 4: Publish to GitHub
export async function publishToGitHub(
  topic: TopicPlan,
  content: string,
  wordCount: number,
  send: (event: Record<string, unknown>) => void
): Promise<void> {
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN not configured");
  }

  send({ phase: "publishing", message: "Committing to GitHub..." });

  const frontmatter = `---
title: "${topic.title.replace(/"/g, '\\"')}"
type: blog-post
targetKeywords: ${JSON.stringify(topic.targetKeywords)}
contentGap: "${topic.contentGap.replace(/"/g, '\\"')}"
date: "${new Date().toISOString()}"
description: "${topic.description.replace(/"/g, '\\"')}"
ideaName: "Open Health Data Hub"
status: published
wordCount: ${wordCount}
canonicalUrl: "https://www.openhealthdatahub.com/blog/${topic.slug}"
---

${content}
`;

  const filePath = `content/blog/${topic.slug}.md`;
  const contentBase64 = Buffer.from(frontmatter).toString("base64");

  const ghResponse = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: `Add blog post: ${topic.title}`,
        content: contentBase64,
        branch: "main",
      }),
    }
  );

  if (!ghResponse.ok) {
    const ghError = await ghResponse.text();
    console.error("GitHub API error:", ghError);
    throw new Error(`GitHub commit failed (${ghResponse.status}): ${ghError.slice(0, 200)}`);
  }
}
