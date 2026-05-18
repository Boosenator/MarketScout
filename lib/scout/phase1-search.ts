import { completeJson } from "./anthropic";
import { excludedOpportunityText, excludedRegionText, targetRegionText } from "./markets";
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
      `You are a concise market research scout. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Excluded opportunity types: ${excludedOpportunityText}. Use web search to find fresh, commercially relevant civilian market changes in Ukraine, Europe, and the USA only. Do not use Russia, Belarus, or CIS markets, examples, companies, regulation, pricing, demand signals, or analogues. Do not use defense, military, weapons, drone warfare, cheap-labor arbitrage, grant-dependent, or government-procurement-first signals. Write all human-facing fields in Russian. Keep every field short.`,
    messages: [
      {
        role: "user",
        content: `Scan these search angles and extract exactly 4 concise civilian commercial signals for target geography: ${targetRegionText}. Exclude ${excludedRegionText} and these opportunity types completely: ${excludedOpportunityText}. title <= 90 chars, source <= 70 chars, relevance_note <= 140 chars.\n${prompts}\n\nSchema: {"signals":[{"title":"...","source":"...","relevance_note":"..."}]}`
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
