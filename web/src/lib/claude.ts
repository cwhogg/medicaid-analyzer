import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";

// Every Claude model the app calls, in one place.
export const MODELS = {
  // NL→SQL, analysis, dataset routing, blog writing
  main: "claude-sonnet-5-5",
  // Small classification / extraction steps in /api/analyze
  fast: "claude-haiku-5-5",
} as const;

type RequestBase = Pick<MessageCreateParamsNonStreaming, "model" | "max_tokens" | "temperature" | "thinking">;

/**
 * Model + token settings for a messages.create call, adjusted per model.
 * Verified against the API 2026-11-22:
 * - Claude 5.x rejects `temperature` ("deprecated for this model"); only 4.x gets it.
 * - Claude 5.x can think by default, and thinking counts against max_tokens,
 *   which these 4.x-sized budgets don't leave room for. Turn it off:
 *   Sonnet 5.5 via { type: "between_tools" } (it rejects "disabled"),
 *   Haiku 5.5 via { type: "disabled" }.
 */
export function claudeRequest(model: string, opts: { maxTokens: number; temperature?: number }): RequestBase {
  const base: RequestBase = { model, max_tokens: opts.maxTokens };
  if (/^claude-(sonnet|haiku|opus)-4/.test(model) && opts.temperature !== undefined) base.temperature = opts.temperature;
  // The installed SDK's types predate "between_tools"; the API accepts it.
  if (/^claude-sonnet-5-5/.test(model)) base.thinking = { type: "between_tools" } as unknown as RequestBase["thinking"];
  else if (/^claude-(haiku|sonnet)-5/.test(model)) base.thinking = { type: "disabled" };
  return base;
}
