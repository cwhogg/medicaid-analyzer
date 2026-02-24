import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateSchemaPrompt } from "@/lib/schemas";
import { validateSQL } from "@/lib/sqlValidation";
import { executeRemoteQuery } from "@/lib/railway";
import { getAllPosts } from "@/lib/content";

export const maxDuration = 300;

const ADMIN_SECRET = process.env.ADMIN_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = "cwhogg";
const GITHUB_REPO = "medicaid-analyzer";

interface AnalysisStep {
  question: string;
  sql: string;
  columns: string[];
  rows: unknown[][];
}

// Stream newline-delimited JSON events back to the client
function streamResponse(
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
  if (!GITHUB_TOKEN) {
    return Response.json(
      { error: "GITHUB_TOKEN not configured" },
      { status: 500 }
    );
  }

  return streamResponse(async (send) => {
    const start = Date.now();
    const client = new Anthropic({ apiKey });

    // Get existing post titles to avoid repetition
    let existingTitles: string[] = [];
    try {
      existingTitles = getAllPosts("blog").map((p) => p.frontmatter.title);
    } catch {
      // On Vercel runtime, content dir may not exist — that's fine
    }

    // --- Phase 1: Topic Generation ---
    send({ phase: "topic", message: "Generating topic..." });

    const topicResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0.7,
      system: `You generate novel, SEO-optimized blog post topics for a Medicaid spending analysis site. The site has a 227-million-row dataset of Medicaid provider spending claims from Jan 2018 to Sep 2024, covering billing NPI, HCPCS/CPT procedure codes, monthly totals, claims counts, and beneficiary counts across 617K+ providers.

You must return a JSON object with these fields:
- title: SEO-optimized article title (50-70 chars)
- slug: URL-friendly slug (lowercase, hyphens)
- description: Meta description for SEO (120-160 chars)
- targetKeywords: array of 3-5 SEO keywords
- contentGap: what gap this content fills
- analysisQuestions: array of 2-3 specific analytical questions to investigate using SQL queries against the dataset

Return ONLY valid JSON, no markdown fences or explanation.`,
      messages: [
        {
          role: "user",
          content: `Generate a novel Medicaid spending analysis topic. Avoid topics already covered:\n${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}`,
        },
      ],
    });

    const topicText = topicResponse.content.find((b) => b.type === "text");
    if (!topicText || topicText.type !== "text") {
      send({ phase: "error", message: "Topic generation returned no text" });
      return;
    }

    let topic: {
      title: string;
      slug: string;
      description: string;
      targetKeywords: string[];
      contentGap: string;
      analysisQuestions: string[];
    };
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
    const schemaPrompt = generateSchemaPrompt();
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
              text: `You are a SQL expert that translates natural language questions into DuckDB SQL queries for a Medicaid provider spending dataset.\n\n${schemaPrompt}\n\nRules:\n- Return ONLY the SQL query, nothing else. No markdown, no explanation, no code fences.\n- Always include a LIMIT clause (max 100 for blog data tables).\n- Only use SELECT statements.\n- Use DuckDB SQL syntax.\n- Format dollar amounts with ROUND(..., 0).\n- IMPORTANT: Oct-Dec 2024 data is incomplete. Add AND claim_month < '2024-10-01' for time series.`,
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

        const result = await executeRemoteQuery(sql);
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

    if (analysisSteps.length === 0) {
      send({ phase: "error", message: "All analysis queries failed" });
      return;
    }

    // --- Phase 3: Blog Writing ---
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
      system: `You are a data journalist writing for a Medicaid spending analysis blog. Write engaging, authoritative articles backed by real data. Your audience includes healthcare policy researchers, analysts, and journalists.

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
      send({ phase: "error", message: "Blog writing returned no text" });
      return;
    }

    const bodyContent = writeBlock.text.trim();
    const wordCount = bodyContent.split(/\s+/).length;

    send({
      phase: "writing",
      message: `Article written: ${wordCount} words`,
      wordCount,
    });

    // --- Phase 4: Publish via GitHub Contents API ---
    send({ phase: "publishing", message: "Committing to GitHub..." });

    const frontmatter = `---
title: "${topic.title.replace(/"/g, '\\"')}"
type: blog-post
targetKeywords: ${JSON.stringify(topic.targetKeywords)}
contentGap: "${topic.contentGap.replace(/"/g, '\\"')}"
date: "${new Date().toISOString()}"
description: "${topic.description.replace(/"/g, '\\"')}"
ideaName: "Medicaid Claims Analyzer"
status: published
wordCount: ${wordCount}
canonicalUrl: "https://medicaid-analyzer.vercel.app/blog/${topic.slug}"
---

${bodyContent}
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
      send({
        phase: "error",
        message: `GitHub commit failed (${ghResponse.status}): ${ghError.slice(0, 200)}`,
      });
      return;
    }

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
