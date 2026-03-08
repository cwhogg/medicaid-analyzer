import Anthropic from "@anthropic-ai/sdk";
import { TwitterApi } from "twitter-api-v2";

const TWITTER_API_KEY = process.env.TWITTER_API_KEY;
const TWITTER_API_SECRET = process.env.TWITTER_API_SECRET;
const TWITTER_ACCESS_TOKEN = process.env.TWITTER_ACCESS_TOKEN;
const TWITTER_ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET;

function isConfigured(): boolean {
  return !!(
    TWITTER_API_KEY &&
    TWITTER_API_SECRET &&
    TWITTER_ACCESS_TOKEN &&
    TWITTER_ACCESS_TOKEN_SECRET
  );
}

export async function generateTweet(
  title: string,
  description: string,
  content: string,
  slug: string,
  client: Anthropic
): Promise<{ tweet1: string; tweet2: string }> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    temperature: 0.5,
    system: `You write punchy tweets for Open Health Data Hub, a public health data analysis site. Return ONLY valid JSON with two fields: tweet1 and tweet2. No markdown fences.`,
    messages: [
      {
        role: "user",
        content: `Write a 2-tweet thread for this blog post.

Title: ${title}
Description: ${description}
Article content (first 1500 chars): ${content.slice(0, 1500)}

Rules:
- tweet1: "Did you know?" hook with the most surprising stat from the article. ~200 chars max. No hashtags, no links.
- tweet2: One-sentence teaser + link to https://www.openhealthdatahub.com/blog/${slug}. Include 2-3 relevant hashtags.

Return ONLY JSON: {"tweet1": "...", "tweet2": "..."}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error("Tweet generation returned no text");
  }

  const cleaned = text.text
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

export async function postTweetThread(
  tweet1: string,
  tweet2: string
): Promise<{ tweetId: string; replyId: string }> {
  if (!isConfigured()) {
    console.warn("Twitter credentials not configured — skipping tweet");
    throw new Error("Twitter not configured");
  }

  const twitterClient = new TwitterApi({
    appKey: TWITTER_API_KEY!,
    appSecret: TWITTER_API_SECRET!,
    accessToken: TWITTER_ACCESS_TOKEN!,
    accessSecret: TWITTER_ACCESS_TOKEN_SECRET!,
  });

  const firstTweet = await twitterClient.v2.tweet(tweet1);
  const tweetId = firstTweet.data.id;

  const reply = await twitterClient.v2.reply(tweet2, tweetId);
  const replyId = reply.data.id;

  return { tweetId, replyId };
}

export { isConfigured as isTwitterConfigured };
