import { NextRequest, NextResponse } from "next/server";
import { getAllPosts } from "@/lib/content";

const ADMIN_SECRET = process.env.ADMIN_API_KEY;

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!ADMIN_SECRET || key !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
