import { completeJson } from "./anthropic";
import type { Market, RawIdea, Signal } from "./types";

const model = "claude-haiku-4-5-20251001";

interface IdeaResponse {
  ideas: RawIdea[];
}

export async function generateIdeas(apiKey: string, market: Market, signals: Signal[]): Promise<RawIdea[]> {
  const result = await completeJson<IdeaResponse>({
    apiKey,
    model,
    system:
      "You generate practical startup ideas for small teams. Prefer ideas with fast validation, clear pain, and direct monetization.",
    messages: [
      {
        role: "user",
        content: `Generate 5-8 ideas for market_id=${market.id} from these signals:\n${JSON.stringify(
          signals,
          null,
          2
        )}\n\nSchema: {"ideas":[{"market_id":"...","title":"...","description":"2 sentences","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."]}]}`
      }
    ],
    maxTokens: 2500
  });

  return result.ideas.map((idea) => ({ ...idea, market_id: market.id })).slice(0, 8);
}
