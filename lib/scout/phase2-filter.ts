import { completeJson } from "./anthropic";
import { excludedRegionText, targetRegionText } from "./markets";
import type { RawIdea, ScoredIdea } from "./types";

const model = "claude-haiku-4-5-20251001";

interface FilterResponse {
  ideas: ScoredIdea[];
}

export async function filterAndScoreIdeas(apiKey: string, ideas: RawIdea[]): Promise<ScoredIdea[]> {
  if (ideas.length === 0) {
    return [];
  }

  const result = await completeJson<FilterResponse>({
    apiKey,
    model,
    system:
      `You are a calibrated startup investment filter. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Evaluate market, regulation, channels, and validation for Ukraine, Europe, and the USA only. Never use Russia, Belarus, or CIS as regulatory, pricing, demand, channel, competitor, or analogue context. If an idea only makes sense in excluded geography, kill it with that reason. Be skeptical, but do not kill ideas just because a market is competitive, broad, or has incumbents. Kill only when a hard kill criterion is clearly and specifically true. Otherwise keep killed_at_pass null and score the idea honestly. Write kill_reason and any rewritten human-facing fields in Russian. Keep all copied strings compact.`,
    messages: [
      {
        role: "user",
        content: `Apply pass 1 hard-kill criteria and pass 2 scoring.

Hard-kill only if at least one criterion is clearly true:
- commoditized and needs $10M+ capex before validation
- regulatory hell with no practical workaround
- one dominant player has 70%+ share plus strong network effect
- TAM is clearly below $100M
- impossible for 1-3 people to validate in 6 months

Do not kill for normal competition, uncertain TAM, need for partnerships, brand-building, or weak differentiation. Those should reduce scores, not kill the idea. Do not use killed_at_pass=2 in this response; pass 2 is scoring only. Score all non-killed ideas 0-100 on urgency, timing, advantage, monetization, competition, and MVP speed. total_score is weighted 20/20/15/15/15/15.

Ideas:
${JSON.stringify(
          ideas,
          null,
          2
        )}\n\nSchema: {"ideas":[{"market_id":"...","title":"...","description":"...","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."],"killed_at_pass":1|null,"kill_reason":"... or null","urgency_score":number|null,"timing_score":number|null,"advantage_score":number|null,"monetization_score":number|null,"competition_score":number|null,"mvp_speed_score":number|null,"total_score":number|null}]}`
      }
    ],
    maxTokens: 4500
  });

  return result.ideas;
}
