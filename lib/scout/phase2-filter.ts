import { completeJson } from "./anthropic";
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
      "You are a severe startup investment filter. Kill weak ideas quickly, then score survivors with disciplined criteria.",
    messages: [
      {
        role: "user",
        content: `Apply pass 1 kill criteria and pass 2 scoring. Kill if commoditized with $10M+ capex, regulatory hell, dominant 70%+ network-effect player, TAM below $100M, or impossible for 1-3 people in 6 months. Score survivors 0-100 on urgency, timing, advantage, monetization, competition, and MVP speed. total_score is weighted 20/20/15/15/15/15.\n\nIdeas:\n${JSON.stringify(
          ideas,
          null,
          2
        )}\n\nSchema: {"ideas":[{"market_id":"...","title":"...","description":"...","target_audience":"...","monetization":"...","why_now":"...","signals_used":["..."],"killed_at_pass":1|null,"kill_reason":"... or null","urgency_score":number|null,"timing_score":number|null,"advantage_score":number|null,"monetization_score":number|null,"competition_score":number|null,"mvp_speed_score":number|null,"total_score":number|null}]}`
      }
    ],
    maxTokens: 3500
  });

  return result.ideas;
}
