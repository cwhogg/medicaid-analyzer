import { NextRequest, NextResponse } from "next/server";
import { getAllPosts, getPostBySlug } from "@/lib/content";

const ADMIN_SECRET = process.env.ADMIN_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = "cwhogg";
const GITHUB_REPO = "medicaid-analyzer";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // If slug param is provided, return the full post content
  const slug = request.nextUrl.searchParams.get("slug");
  if (slug) {
    const post = getPostBySlug("blog", slug);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    return NextResponse.json({
      slug: post.slug,
      title: post.frontmatter.title,
      date: post.frontmatter.date,
      wordCount: post.frontmatter.wordCount,
      keywords: post.frontmatter.targetKeywords,
      content: post.content,
      frontmatter: post.frontmatter,
    });
  }

  const posts = getAllPosts("blog");
  const result = posts.map((p) => ({
    slug: p.slug,
    title: p.frontmatter.title,
    date: p.frontmatter.date,
    wordCount: p.frontmatter.wordCount,
    keywords: p.frontmatter.targetKeywords,
  }));

  return NextResponse.json({ posts: result });
}

// PATCH — Update a published blog post and republish to GitHub
export async function PATCH(request: NextRequest) {
  const key =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("x-admin-key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
  }

  const body = await request.json();
  const { slug, content } = body;

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Get existing post to preserve frontmatter
  const post = getPostBySlug("blog", slug);
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const fm = post.frontmatter;

  const frontmatter = `---
title: "${fm.title.replace(/"/g, '\\"')}"
type: ${fm.type}
targetKeywords: ${JSON.stringify(fm.targetKeywords)}
contentGap: "${(fm.contentGap || "").replace(/"/g, '\\"')}"
date: "${fm.date}"
description: "${(fm.description || "").replace(/"/g, '\\"')}"
ideaName: "${fm.ideaName}"
status: ${fm.status}
wordCount: ${wordCount}
canonicalUrl: "${fm.canonicalUrl}"
---

${content.trim()}
`;

  const filePath = `content/blog/${slug}.md`;
  const ghHeaders = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github.v3+json",
  };

  try {
    // Get existing file sha
    const existingRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      { headers: ghHeaders }
    );
    if (!existingRes.ok) {
      return NextResponse.json({ error: "File not found on GitHub" }, { status: 404 });
    }
    const existing = await existingRes.json();

    // Update on GitHub
    const contentBase64 = Buffer.from(frontmatter).toString("base64");
    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify({
          message: `Update blog post: ${fm.title}`,
          content: contentBase64,
          sha: existing.sha,
          branch: "main",
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.text();
      return NextResponse.json({ error: `GitHub update failed: ${err.slice(0, 200)}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, wordCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
