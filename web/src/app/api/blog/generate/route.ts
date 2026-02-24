import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  const start = Date.now();

  // Auth
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  if (!GITHUB_TOKEN) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not configured" },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    // Get existing post titles to avoid repetition
    const existingPosts = getAllPosts("blog");
    const existingTitles = existingPosts.map((p) => p.frontmatter.title);

    // --- Phase 1: Topic Generation ---
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
      return NextResponse.json(
        { error: "Topic generation failed" },
        { status: 500 }
      );
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
      return NextResponse.json(
        { error: "Topic generation returned invalid JSON", raw: topicText.text },
        { status: 500 }
      );
    }

    // --- Phase 2: Analysis Execution ---
    const schemaPrompt = generateSchemaPrompt();
    const analysisSteps: AnalysisStep[] = [];

    for (const question of topic.analysisQuestions) {
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
      if (!sqlBlock || sqlBlock.type !== "text") continue;

      let sql = sqlBlock.text.trim();
      if (sql.startsWith("```")) {
        sql = sql
          .replace(/^```(?:sql)?\n?/, "")
          .replace(/\n?```$/, "")
          .trim();
      }
      if (sql.startsWith("CANNOT_ANSWER:")) continue;

      const validation = validateSQL(sql);
      if (!validation.valid) continue;

      try {
        const result = await executeRemoteQuery(sql);
        analysisSteps.push({
          question,
          sql,
          columns: result.columns,
          rows: result.rows.slice(0, 50),
        });
      } catch (err) {
        console.error(`Blog gen: query failed for "${question}":`, err);
      }
    }

    if (analysisSteps.length === 0) {
      return NextResponse.json(
        { error: "All analysis queries failed" },
        { status: 500 }
      );
    }

    // --- Phase 3: Blog Writing ---
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
      return NextResponse.json(
        { error: "Blog writing failed" },
        { status: 500 }
      );
    }

    const bodyContent = writeBlock.text.trim();
    const wordCount = bodyContent.split(/\s+/).length;

    // Build full markdown file
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

    // --- Phase 4: Publish via GitHub Contents API ---
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
      return NextResponse.json(
        { error: `GitHub commit failed: ${ghResponse.status}`, details: ghError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      slug: topic.slug,
      title: topic.title,
      wordCount,
      analysisSteps: analysisSteps.length,
      generationMs: Date.now() - start,
    });
  } catch (err) {
    console.error("Blog generation error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
