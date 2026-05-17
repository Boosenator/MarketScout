import { completeJson } from "./anthropic";
import type { Market, Signal } from "./types";

const model = "claude-haiku-4-5-20251001";

interface SignalResponse {
  signals: Array<Omit<Signal, "market_id">>;
}

export async function scoutMarketSignals(apiKey: string, market: Market): Promise<Signal[]> {
  const prompts = market.searchAngles.map((angle) => `${market.name}: ${angle}`).join("\n");

  const result = await completeJson<SignalResponse>({
    apiKey,
    model,
    system:
      "You are a market research scout. Use web search signals to find fresh, commercially relevant market changes. Write all human-facing fields in Russian.",
    messages: [
      {
        role: "user",
        content: `Scan these search angles and extract 10-15 concise signals.\n${prompts}\n\nSchema: {"signals":[{"title":"...","source":"...","relevance_note":"..."}]}`
      }
    ],
    maxTokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search" }]
  });

  return result.signals.slice(0, 15).map((signal) => ({
    ...signal,
    market_id: market.id
  }));
}
