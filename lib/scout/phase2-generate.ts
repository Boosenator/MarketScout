import { completeJson } from "./anthropic";
import { containsExcludedRegion, excludedRegionText, targetRegionText } from "./markets";
import type { Market, RawIdea, Signal } from "./types";

const model = "claude-haiku-4-5-20251001";

interface IdeaResponse {
  ideas: RawIdea[];
}

export async function generateIdeas(apiKey: string, market: Market, signals: Signal[]): Promise<RawIdea[]> {
  const compactSignals = signals.slice(0, 8).map((signal) => ({
    title: clip(signal.title, 120),
    source: clip(signal.source, 80),
    relevance_note: clip(signal.relevance_note, 180)
  }));
  const result = await completeJson<IdeaResponse>({
    apiKey,
    model,
    system:
      `You generate practical startup ideas for small teams. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Use web search before generating: look for current startups, market reports, Reddit/forum pain, TikTok/creator trends, marketplaces, and monetization examples in Ukraine, Europe, and the USA only. Never use Russia, Belarus, or CIS markets, examples, companies, regulation, pricing, demand signals, or analogues. Ideas must be grounded in web evidence, not generic brainstorming. Prefer ideas with fast validation, clear pain, and direct monetization. Write all human-facing fields in Russian. Keep every string compact: title <= 80 chars, description <= 220 chars, target_audience/monetization/why_now <= 180 chars.`,
    messages: [
      {
        role: "user",
        content: `Generate exactly 5 compact ideas for market_id=${market.id}. Target geography: ${targetRegionText}. Exclude ${excludedRegionText} completely.

Workflow:
1. Search the web for fresh examples connected to these signals in Ukraine, Europe, and the USA.
2. Prefer ideas where you can point to real demand signals, real spending, or real companies/creators already proving part of the behavior.
3. Do not invent market sizes, revenue, or analogues. If uncertain, phrase conservatively.
4. In signals_used, include signal titles plus source/company/site names discovered via web search.
5. Prefer EU/US/UA go-to-market, pricing, regulation, and channels. Mention region explicitly when it affects the idea.
6. Reject any idea that depends on Russia, Belarus, CIS, Russian regulation, Russian platforms, Russian companies, or Russian consumer demand.

Signals:
${JSON.stringify(
          compactSignals,
          null,
          2
        )}\n\nSchema: {"ideas":[{"market_id":"...","title":"...","description":"2 sentences","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."]}]}`
      }
    ],
    maxTokens: 4500,
    tools: [{ type: "web_search_20250305", name: "web_search" }]
  });

  return result.ideas
    .map((idea) => ({ ...idea, market_id: market.id }))
    .filter((idea) => !containsExcludedRegion(JSON.stringify(idea)))
    .slice(0, 8);
}

function clip(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}
