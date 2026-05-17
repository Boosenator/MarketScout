import { completeJson } from "./anthropic";
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
      "You are a pragmatic venture analyst. Produce a concrete deep dive with competitors, entry paths, risks, and a first validation step.",
    messages: [
      {
        role: "user",
        content: `Deep dive this idea:\n${JSON.stringify(
          idea,
          null,
          2
        )}\n\nSchema: {"deep_dive":{"analogues":["..."],"entry_bootstrap":"...","entry_vc":"...","entry_lifestyle":"...","main_risks":["..."],"risk_mitigations":["..."],"first_validation_step":"...","team_fit_score":0}}`
      }
    ],
    maxTokens: 2500
  });

  return result.deep_dive;
}
