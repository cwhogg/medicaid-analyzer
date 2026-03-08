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
