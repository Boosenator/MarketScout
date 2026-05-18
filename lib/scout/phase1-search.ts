import { completeJson } from "./anthropic";
import { excludedRegionText, targetRegionText } from "./markets";
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
      `You are a concise market research scout. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Use web search to find fresh, commercially relevant market changes in Ukraine, Europe, and the USA only. Do not use Russia, Belarus, or CIS markets, examples, companies, regulation, pricing, demand signals, or analogues. Write all human-facing fields in Russian. Keep every field short.`,
    messages: [
      {
        role: "user",
        content: `Scan these search angles and extract exactly 4 concise signals for target geography: ${targetRegionText}. Exclude ${excludedRegionText} completely. title <= 90 chars, source <= 70 chars, relevance_note <= 140 chars.\n${prompts}\n\nSchema: {"signals":[{"title":"...","source":"...","relevance_note":"..."}]}`
      }
    ],
    maxTokens: 1200,
    tools: [{ type: "web_search_20250305", name: "web_search" }]
  });

  return result.signals.slice(0, 4).map((signal) => ({
    ...signal,
    market_id: market.id
  }));
}
