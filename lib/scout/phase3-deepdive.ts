import { completeJson } from "./anthropic";
import { containsExcludedRegion, excludedRegionText, targetRegionText } from "./markets";
import type { DeepDive, ScoredIdea } from "./types";

const model = "claude-sonnet-4-6";

interface DeepDiveResponse {
  deep_dive: DeepDive;
}

export async function deepDiveIdea(apiKey: string, idea: ScoredIdea): Promise<DeepDive> {
  const result = await completeJson<DeepDiveResponse>({
    apiKey,
    model,
    system:
      `You are a pragmatic venture analyst. Target geography: ${targetRegionText}. Excluded geography: ${excludedRegionText}. Use web search to verify analogues, competitors, risks, regulation, and current market context in Ukraine, Europe, and the USA before writing. Never use Russia, Belarus, or CIS markets, companies, platforms, laws, pricing, demand, or analogues. Do not invent company traction or revenue. If exact revenue is unavailable, say what is observable instead. Produce a concrete deep dive with entry paths, risks, and a first validation step. Write all human-facing fields in Russian. team_fit_score must be an integer from 0 to 10, not a percentage.`,
    messages: [
      {
        role: "user",
        content: `Deep dive this idea using fresh web research for target geography: ${targetRegionText}. Exclude ${excludedRegionText} completely.

Requirements:
- analogues must be real companies/products/creators/marketplaces found or verified online in Ukraine, Europe, or the USA.
- do not mention Russia, Belarus, CIS, Russian regulation, Russian platforms, Russian companies, or Russian consumer demand.
- include what each analogue proves: demand, pricing, channel, positioning, or distribution.
- first_validation_step must be executable in 7-14 days without building full tech.
- main_risks must include one market/channel/regulatory risk for EU/US/UA if relevant.

Idea:
${JSON.stringify(
          idea,
          null,
          2
        )}\n\nSchema: {"deep_dive":{"analogues":["..."],"entry_bootstrap":"...","entry_vc":"...","entry_lifestyle":"...","main_risks":["..."],"risk_mitigations":["..."],"first_validation_step":"...","team_fit_score":7}}`
      }
    ],
    maxTokens: 3500,
    tools: [{ type: "web_search_20250305", name: "web_search" }]
  });

  return sanitizeDeepDive({
    ...result.deep_dive,
    team_fit_score: normalizeTeamFitScore(result.deep_dive.team_fit_score)
  });
}

function normalizeTeamFitScore(score: number): number {
  const normalized = score > 10 && score <= 100 ? score / 10 : score;
  return Math.max(0, Math.min(10, Math.round(normalized)));
}

function sanitizeDeepDive(deepDive: DeepDive): DeepDive {
  return {
    ...deepDive,
    analogues: deepDive.analogues.filter((item) => !containsExcludedRegion(item)),
    main_risks: deepDive.main_risks.filter((item) => !containsExcludedRegion(item)),
    risk_mitigations: deepDive.risk_mitigations.filter((item) => !containsExcludedRegion(item)),
    entry_bootstrap: sanitizeText(deepDive.entry_bootstrap),
    entry_vc: sanitizeText(deepDive.entry_vc),
    entry_lifestyle: sanitizeText(deepDive.entry_lifestyle),
    first_validation_step: sanitizeText(deepDive.first_validation_step)
  };
}

function sanitizeText(value: string): string {
  if (!containsExcludedRegion(value)) {
    return value;
  }

  return "Требуется перепроверка для целевой географии: Украина, Европа, США.";
}
