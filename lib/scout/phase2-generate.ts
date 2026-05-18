import { completeJson } from "./anthropic";
import { containsExcludedRegion, excludedRegionText, targetRegionText } from "./markets";
import type { Market, RawIdea, Signal } from "./types";

const model = "claude-haiku-4-5-20251001";
const perSignalDelayMs = 3000;

export interface GenerateIdeasOptions {
  maxSignals?: number;
  useWebSearch?: boolean;
}

interface IdeaResponse {
  ideas: RawIdea[];
}

export async function generateIdeas(
  apiKey: string,
  market: Market,
  signals: Signal[],
  options: GenerateIdeasOptions = {}
): Promise<RawIdea[]> {
  const maxSignals = options.maxSignals ?? 2;
  const ideas: RawIdea[] = [];

  for (const signal of signals.slice(0, maxSignals)) {
    const generated = await generateIdeasForSignal(apiKey, market, signal, options.useWebSearch ?? true);
    ideas.push(...generated);
    await sleep(perSignalDelayMs);
  }

  return dedupeIdeas(ideas)
    .filter((idea) => !containsExcludedRegion(JSON.stringify(idea)))
    .slice(0, maxSignals);
}

async function generateIdeasForSignal(
  apiKey: string,
  market: Market,
  signal: Signal,
  useWebSearch: boolean
): Promise<RawIdea[]> {
  const compactSignal = {
    title: clip(signal.title, 120),
    source: clip(signal.source, 80),
    relevance_note: clip(signal.relevance_note, 180)
  };
  const result = await completeJson<IdeaResponse>({
    apiKey,
    model,
    system: `You generate practical startup ideas for small teams. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. ${useWebSearch ? "Use web search before generating: look for current startups, market reports, forum pain, creator trends, marketplaces, and monetization examples in Ukraine, Europe, and the USA only." : "Use the provided web-grounded signal as the only research input; do not perform additional web research."} Never use Russia, Belarus, or CIS markets, examples, companies, regulation, pricing, demand signals, or analogues. Ideas must be grounded in evidence, not generic brainstorming. Prefer fast validation, clear pain, and direct monetization. Write all human-facing fields in Russian. Keep every string compact: title <= 70 chars, description <= 180 chars, target_audience/monetization/why_now <= 140 chars.`,
    messages: [
      {
        role: "user",
        content: `Generate exactly 1 compact idea for market_id=${market.id}. Target geography: ${targetRegionText}. Exclude ${excludedRegionText} completely.

Workflow:
1. Use only this one signal as the seed.
2. ${useWebSearch ? "Search the web for fresh examples connected to this signal in Ukraine, Europe, and the USA." : "Do not call web search; extract one practical idea directly from this signal."}
3. Prefer ideas where you can point to real demand signals, real spending, or real companies/creators already proving part of the behavior.
4. Do not invent market sizes, revenue, or analogues. If uncertain, phrase conservatively.
5. In signals_used, include the signal title plus source/company/site names discovered via web search.
6. Prefer EU/US/UA go-to-market, pricing, regulation, and channels. Mention region explicitly when it affects the idea.
7. Reject any idea that depends on Russia, Belarus, CIS, Russian regulation, Russian platforms, Russian companies, or Russian consumer demand.

Signal:
${JSON.stringify(compactSignal, null, 2)}

Schema: {"ideas":[{"market_id":"...","title":"...","description":"2 sentences","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."]}]}`
      }
    ],
    maxTokens: useWebSearch ? 1600 : 900,
    tools: useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined
  });

  return result.ideas
    .map((idea) => ({ ...idea, market_id: market.id }))
    .filter((idea) => !containsExcludedRegion(JSON.stringify(idea)))
    .slice(0, 1);
}

function dedupeIdeas(ideas: RawIdea[]): RawIdea[] {
  const seen = new Set<string>();

  return ideas.filter((idea) => {
    const key = `${idea.market_id}:${idea.title.trim().toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function clip(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}...`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
