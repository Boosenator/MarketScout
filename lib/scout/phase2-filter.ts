import { completeJson } from "./anthropic";
import { containsExcludedOpportunity, excludedOpportunityText, excludedRegionText, targetRegionText } from "./markets";
import type { RawIdea, ScoredIdea } from "./types";

const model = "claude-haiku-4-5-20251001";

interface FilterResponse {
  ideas: ScoredIdea[];
}

export async function filterAndScoreIdeas(apiKey: string, ideas: RawIdea[]): Promise<ScoredIdea[]> {
  if (ideas.length === 0) {
    return [];
  }

  return filterAndScoreBatch(apiKey, ideas);
}

async function filterAndScoreBatch(apiKey: string, ideas: RawIdea[]): Promise<ScoredIdea[]> {
  const compactIdeas = ideas.map((idea) => ({
    ...idea,
    description: clip(idea.description, 360),
    target_audience: clip(idea.target_audience, 240),
    monetization: clip(idea.monetization, 240),
    why_now: clip(idea.why_now, 240),
    signals_used: idea.signals_used.slice(0, 2).map((signal) => clip(signal, 180))
  }));

  const result = await completeJson<FilterResponse>({
    apiKey,
    model,
    system: `You are a calibrated startup investment filter. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Excluded opportunity types: ${excludedOpportunityText}. Evaluate market, regulation, channels, and validation for Ukraine, Europe, and the USA only. Never use Russia, Belarus, or CIS as regulatory, pricing, demand, channel, competitor, or analogue context. If an idea only makes sense in excluded geography or in excluded opportunity types, kill it with that reason. Be skeptical, but do not kill ideas just because a market is competitive, broad, or has incumbents. Write kill_reason and any rewritten human-facing fields in Russian. Keep all copied strings compact.`,
    messages: [
      {
        role: "user",
        content: `Apply pass 1 hard-kill criteria and pass 2 scoring to these ideas. Return exactly one scored object per input idea, preserving order.

Hard-kill only if at least one criterion is clearly true:
- defense, weapons, military, war, drones/UAVs, or dual-use military supply chain
- cheap-labor arbitrage or exploitative labor positioning
- grant-dependent, guaranteed-employment, or government-procurement-first model
- commoditized and needs $10M+ capex before validation
- regulatory hell with no practical workaround
- one dominant player has 70%+ share plus strong network effect
- TAM is clearly below $100M
- impossible for 1-3 people to validate in 6 months

Do not kill for normal competition, uncertain TAM, need for partnerships, brand-building, or weak differentiation. Those should reduce scores, not kill the idea. Do not use killed_at_pass=2 in this response; pass 2 is scoring only. Score the idea 0-100 on urgency, timing, advantage, monetization, competition, and MVP speed. total_score is weighted 20/20/15/15/15/15.

Ideas:
${JSON.stringify(compactIdeas, null, 2)}

Schema: {"ideas":[{"market_id":"...","title":"...","description":"...","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."],"killed_at_pass":1|null,"kill_reason":"... or null","urgency_score":number|null,"timing_score":number|null,"advantage_score":number|null,"monetization_score":number|null,"competition_score":number|null,"mvp_speed_score":number|null,"total_score":number|null}]}`
      }
    ],
    maxTokens: 2200
  });

  return result.ideas.map((idea) => {
    if (containsExcludedOpportunity(JSON.stringify(idea))) {
      return {
        ...idea,
        killed_at_pass: 1,
        kill_reason: "Идея относится к исключённым типам: defense/war/drones/cheap labor/grants/government-first."
      };
    }

    return idea;
  });
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const clipped = value.slice(0, maxLength);
  const lastSentence = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf("!"), clipped.lastIndexOf("?"));

  if (lastSentence > maxLength * 0.45) {
    return clipped.slice(0, lastSentence + 1);
  }

  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : maxLength).trim()}.`;
}
