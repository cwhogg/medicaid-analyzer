import { runDailyBlogPipeline } from "@/lib/autoBlog";

export const maxDuration = 300;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runDailyBlogPipeline();
  return Response.json(result);
}
