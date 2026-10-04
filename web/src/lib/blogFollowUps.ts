import type Anthropic from "@anthropic-ai/sdk";
import { getAllDatasets } from "@/lib/datasets/index";

export interface FollowUp {
  question: string;
  dataset: string;
}

const MAX_FOLLOW_UPS = 3;
const MAX_QUESTION_LENGTH = 200;

// Link to the dataset's query page with the question pre-filled. UTM params
// let the admin traffic page attribute clicks to the originating post.
export function followUpHref(followUp: FollowUp, slug: string): string {
  const params = new URLSearchParams({
    q: followUp.question,
    utm_source: "blog",
    utm_medium: "followup",
    utm_campaign: slug,
  });
  return `/${followUp.dataset}?${params.toString()}`;
}

export function sanitizeFollowUps(raw: unknown): FollowUp[] {
  if (!Array.isArray(raw)) return [];
  const validKeys = new Set(getAllDatasets().map((d) => d.key));
  return raw
    .filter(
      (f): f is FollowUp =>
        !!f &&
        typeof f.question === "string" &&
        typeof f.dataset === "string" &&
        validKeys.has(f.dataset) &&
        f.question.trim().length > 0 &&
        f.question.length <= MAX_QUESTION_LENGTH
    )
    .map((f) => ({ question: f.question.trim(), dataset: f.dataset }))
    .slice(0, MAX_FOLLOW_UPS);
}

// Generate follow-up questions a reader could run against our datasets.
// Never throws — follow-ups are optional, so failures return [].
export async function generateFollowUps(
  title: string,
  body: string,
  client: Anthropic,
  primaryDataset?: string
): Promise<FollowUp[]> {
  const datasetList = getAllDatasets()
    .map((d) => {
      const examples = (d.exampleQueries || []).map((e) => `    - ${e.question}`).join("\n");
      return `- key "${d.key}" (${d.label}): ${d.systemPromptPreamble}\n  Example questions that work:\n${examples}`;
    })
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      temperature: 0,
      system: `You suggest follow-up questions for readers of a data journalism article on Open Health Data Hub. Each question is pre-filled into a natural-language query tool that turns it into SQL against one dataset.

Available datasets:
${datasetList}

Rules:
- Return exactly ${MAX_FOLLOW_UPS} questions as a JSON array: [{"question": "...", "dataset": "<key>"}]. No other text.
- Each question extends the article: a different breakdown (by state, age, sex, income, year, specialty), a narrower slice, or the next obvious thing a curious reader would ask. Do not just restate the article's headline finding.
- Each question must be answerable with a single aggregate SQL query on ONE dataset. Phrase it like the example questions: concrete, specific, one sentence, under 150 characters.
- Only ask about measures that dataset clearly contains. Stay within its years.${primaryDataset ? `\n- The article uses the "${primaryDataset}" dataset. Use it for at least two questions.` : ""}`,
      messages: [
        {
          role: "user",
          content: `Title: ${title}\n\n${body.slice(0, 12000)}`,
        },
      ],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return [];
    const match = block.text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return sanitizeFollowUps(JSON.parse(match[0]));
  } catch (err) {
    console.error("Follow-up generation failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
