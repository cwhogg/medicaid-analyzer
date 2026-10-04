// One-off: add `followUps` frontmatter to existing blog posts that lack it.
// Run from web/ so the @/ path alias resolves:
//   cd web && NODE_PATH=$PWD/node_modules ANTHROPIC_API_KEY=... npx tsx ../scripts/backfill_blog_followups.ts [--force]
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Anthropic from "@anthropic-ai/sdk";
import { generateFollowUps } from "@/lib/blogFollowUps";

const BLOG_DIR = path.join(process.cwd(), "..", "content", "blog");
const CONCURRENCY = 5;
const force = process.argv.includes("--force");

async function processFile(client: Anthropic, file: string): Promise<string> {
  const filePath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  if (data.followUps && !force) return `skip  ${file}`;

  const followUps = await generateFollowUps(data.title, content, client);
  if (followUps.length === 0) return `FAIL  ${file}`;

  // Insert/replace one line in the frontmatter instead of re-serializing,
  // so the rest of the file stays byte-identical.
  const line = `followUps: ${JSON.stringify(followUps)}`;
  const end = raw.indexOf("\n---", 3);
  let head = raw.slice(0, end).replace(/\nfollowUps: .*$/m, "");
  head += `\n${line}`;
  fs.writeFileSync(filePath, head + raw.slice(end));
  return `ok    ${file}  [${followUps.map((f) => f.dataset).join(", ")}]`;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.replace(/^["']|["']$/g, "");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md")).sort();
  const queue = [...files];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const file = queue.shift()!;
      console.log(await processFile(client, file));
    }
  });
  await Promise.all(workers);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
