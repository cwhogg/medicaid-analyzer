import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface PostFrontmatter {
  title: string;
  type: string;
  targetKeywords: string[];
  contentGap: string;
  date: string;
  ideaName: string;
  status: string;
  wordCount: number;
  canonicalUrl: string;
  description?: string;
}

export interface Post {
  slug: string;
  frontmatter: PostFrontmatter;
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "..", "content");

export function getAllPosts(contentType: string): Post[] {
  const dir = path.join(CONTENT_DIR, contentType);

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));

  const posts: Post[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8");
    const { data, content } = matter(raw);
    const frontmatter = data as PostFrontmatter;

    if (frontmatter.status !== "published") continue;

    posts.push({
      slug: file.replace(/\.md$/, ""),
      frontmatter,
      content,
    });
  }

  posts.sort(
    (a, b) =>
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
  );

  return posts;
}

export function getPostBySlug(
  contentType: string,
  slug: string
): Post | null {
  const filePath = path.join(CONTENT_DIR, contentType, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const frontmatter = data as PostFrontmatter;

  return { slug, frontmatter, content };
}
