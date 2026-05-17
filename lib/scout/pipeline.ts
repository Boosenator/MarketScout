import { getEnv } from "@/lib/config";
import { markets } from "@/lib/scout/markets";
import { scoutMarketSignals } from "@/lib/scout/phase1-search";
import { generateIdeas } from "@/lib/scout/phase2-generate";
import { filterAndScoreIdeas } from "@/lib/scout/phase2-filter";
import { deepDiveIdea } from "@/lib/scout/phase3-deepdive";
import type { IdeaRecord, PipelineSummary, ScoredIdea } from "@/lib/scout/types";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  attachDeepDive,
  attachTelegramMessage,
  createScoutSession,
  insertIdeas,
  insertSignals,
  updateScoutSession
} from "@/lib/supabase/queries";
import { createBot } from "@/lib/telegram/bot";
import { postDigest, postIdea } from "@/lib/telegram/post-idea";

const phaseDelayMs = 500;

export async function runScoutPipeline(): Promise<PipelineSummary> {
  const env = getEnv();
  const db = createSupabaseAdmin();
  const session = await createScoutSession(db);

  let marketsScanned = 0;
  let ideasGenerated = 0;
  let killedPass1 = 0;
  let killedPass2 = 0;
  const survivors: IdeaRecord[] = [];

  try {
    for (const market of markets) {
      try {
        const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
        await insertSignals(db, session.id, signals);
        await sleep(phaseDelayMs);

        const rawIdeas = await generateIdeas(env.ANTHROPIC_API_KEY, market, signals);
        await sleep(phaseDelayMs);

        const scoredIdeas = await filterAndScoreIdeas(env.ANTHROPIC_API_KEY, rawIdeas);
        const savedIdeas = await insertIdeas(db, session.id, scoredIdeas);
        const marketSurvivors = topSurvivors(scoredIdeas);

        marketsScanned += 1;
        ideasGenerated += scoredIdeas.length;
        killedPass1 += scoredIdeas.filter((idea) => idea.killed_at_pass === 1).length;
        killedPass2 += scoredIdeas.filter((idea) => idea.killed_at_pass === 2).length;

        survivors.push(...savedIdeas.filter((idea) => marketSurvivors.some((survivor) => sameIdea(survivor, idea))));

        await updateScoutSession(db, session.id, {
          markets_scanned: marketsScanned,
          ideas_generated: ideasGenerated,
          ideas_killed_p1: killedPass1,
          ideas_killed_p2: killedPass2,
          survivors: survivors.length
        });
      } catch (error) {
        console.error(`Market failed: ${market.id}`, error);
      }
    }

    const topFive = survivors.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)).slice(0, 5);
    const withDeepDives: IdeaRecord[] = [];

    for (const idea of topFive) {
      try {
        const deepDive = await deepDiveIdea(env.ANTHROPIC_API_KEY, idea);
        withDeepDives.push(await attachDeepDive(db, idea.id, deepDive));
        await sleep(phaseDelayMs);
      } catch (error) {
        console.error(`Deep dive failed: ${idea.id}`, error);
      }
    }

    const summary: PipelineSummary = {
      sessionId: session.id,
      marketsScanned,
      ideasGenerated,
      killedPass1,
      killedPass2,
      survivors: survivors.length,
      posted: 0
    };

    const bot = createBot();
    await postDigest(bot, summary);

    for (const idea of withDeepDives) {
      const messageId = await postIdea(bot, idea);
      await attachTelegramMessage(db, idea.id, messageId);
      summary.posted += 1;
      await sleep(phaseDelayMs);
    }

    await updateScoutSession(db, session.id, {
      status: "done",
      markets_scanned: marketsScanned,
      ideas_generated: ideasGenerated,
      ideas_killed_p1: killedPass1,
      ideas_killed_p2: killedPass2,
      survivors: survivors.length
    });

    return summary;
  } catch (error) {
    await updateScoutSession(db, session.id, { status: "failed" });
    throw error;
  }
}

function topSurvivors(ideas: ScoredIdea[]): ScoredIdea[] {
  return ideas
    .filter((idea) => idea.killed_at_pass === null && (idea.total_score ?? 0) >= 65)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
}

function sameIdea(a: ScoredIdea, b: IdeaRecord): boolean {
  return a.market_id === b.market_id && a.title.trim().toLowerCase() === b.title.trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
