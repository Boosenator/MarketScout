import { getCronEnv } from "@/lib/config";
import { getAnthropicEnv } from "@/lib/config";
import { markets } from "@/lib/scout/markets";
import { scoutMarketSignals } from "@/lib/scout/phase1-search";
import { generateIdeas } from "@/lib/scout/phase2-generate";
import { filterAndScoreIdeas } from "@/lib/scout/phase2-filter";
import { deepDiveIdea } from "@/lib/scout/phase3-deepdive";
import type { IdeaRecord, PipelineSummary } from "@/lib/scout/types";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  attachDeepDive,
  attachTelegramMessage,
  createScoutSession,
  findRunningSession,
  insertIdeas,
  insertSignals,
  loadSessionSurvivors,
  updateScoutSession
} from "@/lib/supabase/queries";
import { createTelegramClient } from "@/lib/telegram/client";
import { postDigest, postIdea } from "@/lib/telegram/post-idea";

const CHUNK_SIZE = 4;
const phaseDelayMs = 500;

/**
 * Processes one chunk of markets per invocation.
 * If markets remain after the chunk, fires a self-trigger to continue in a fresh invocation.
 * selfTriggerUrl — the full URL of /api/cron/scout (passed from route.ts to avoid env coupling).
 */
export async function runScoutPipeline(selfTriggerUrl: string): Promise<PipelineSummary> {
  const env = getAnthropicEnv();
  const db = createSupabaseAdmin();

  // Resume an in-progress session or start a new one
  const existing = await findRunningSession(db);
  const session = existing ?? (await createScoutSession(db));

  // Pick up counters from where the last chunk left off
  let marketsScanned = session.markets_scanned;
  let ideasGenerated = session.ideas_generated;
  let killedPass1 = session.ideas_killed_p1;
  let killedPass2 = session.ideas_killed_p2;
  let survivorsCount = session.survivors;

  const chunkMarkets = markets.slice(marketsScanned, marketsScanned + CHUNK_SIZE);

  try {
    for (const market of chunkMarkets) {
      try {
        const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
        await insertSignals(db, session.id, signals);
        await sleep(phaseDelayMs);

        const rawIdeas = await generateIdeas(env.ANTHROPIC_API_KEY, market, signals);
        await sleep(phaseDelayMs);

        const scoredIdeas = await filterAndScoreIdeas(env.ANTHROPIC_API_KEY, rawIdeas);
        await insertIdeas(db, session.id, scoredIdeas);

        marketsScanned += 1;
        ideasGenerated += scoredIdeas.length;
        killedPass1 += scoredIdeas.filter((i) => i.killed_at_pass === 1).length;
        killedPass2 += scoredIdeas.filter((i) => i.killed_at_pass === 2).length;
        survivorsCount += scoredIdeas.filter(
          (i) => i.killed_at_pass === null && (i.total_score ?? 0) >= 65
        ).length;

        await updateScoutSession(db, session.id, {
          markets_scanned: marketsScanned,
          ideas_generated: ideasGenerated,
          ideas_killed_p1: killedPass1,
          ideas_killed_p2: killedPass2,
          survivors: survivorsCount
        });
      } catch (error) {
        console.error(`Market failed: ${market.id}`, error);
      }
    }

    const allMarketsProcessed = marketsScanned >= markets.length;

    if (!allMarketsProcessed) {
      // More markets remain — trigger the next chunk in a fresh invocation
      void selfTrigger(selfTriggerUrl);
      return {
        sessionId: session.id,
        marketsScanned,
        ideasGenerated,
        killedPass1,
        killedPass2,
        survivors: survivorsCount,
        posted: 0
      };
    }

    // All markets done — run Phase 3 and post results
    const survivors = await loadSessionSurvivors(db, session.id);
    const topFive = survivors.slice(0, 5);

    const summary: PipelineSummary = {
      sessionId: session.id,
      marketsScanned,
      ideasGenerated,
      killedPass1,
      killedPass2,
      survivors: survivors.length,
      posted: 0
    };

    await updateScoutSession(db, session.id, { survivors: survivors.length });
    await postMergedAnalysis(env.ANTHROPIC_API_KEY, db, topFive, summary);
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

async function postMergedAnalysis(
  apiKey: string,
  db: ReturnType<typeof createSupabaseAdmin>,
  topIdeas: IdeaRecord[],
  summary: PipelineSummary
): Promise<void> {
  const withDeepDives: IdeaRecord[] = [];

  for (const idea of topIdeas) {
    try {
      const deepDive = await deepDiveIdea(apiKey, idea);
      withDeepDives.push(await attachDeepDive(db, idea.id, deepDive));
      await sleep(phaseDelayMs);
    } catch (error) {
      console.error(`Deep dive failed: ${idea.id}`, error);
    }
  }

  const telegram = createTelegramClient();
  await postDigest(telegram, summary);

  for (const idea of withDeepDives) {
    const messageId = await postIdea(telegram, idea);
    await attachTelegramMessage(db, idea.id, messageId);
    summary.posted += 1;
    await sleep(phaseDelayMs);
  }
}

function selfTrigger(url: string): Promise<void> {
  const { CRON_SECRET } = getCronEnv();
  return fetch(url, {
    method: "GET",
    headers: { "x-cron-secret": CRON_SECRET }
  })
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error("Self-trigger failed", error);
    });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
