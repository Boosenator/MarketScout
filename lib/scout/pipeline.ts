import { getCronEnv, getAnthropicEnv, getTelegramEnv } from "@/lib/config";
import { markets } from "@/lib/scout/markets";
import { scoutMarketSignals } from "@/lib/scout/phase1-search";
import { generateIdeas } from "@/lib/scout/phase2-generate";
import { filterAndScoreIdeas } from "@/lib/scout/phase2-filter";
import { deepDiveIdea } from "@/lib/scout/phase3-deepdive";
import type { IdeaRecord, Market, PipelineSummary } from "@/lib/scout/types";
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

const CHUNK_SIZE = 1;
const phaseDelayMs = 3000;
const maxSignalsPerMarket = 2;
const maxDeepDivesPerRun = 2;

/**
 * Entry point.
 * - marketId provided → run only that one market (no chunking, no resume)
 * - marketId absent   → chunked full run (4 markets per invocation, self-triggers)
 */
export async function runScoutPipeline(selfTriggerUrl: string, marketId?: string): Promise<PipelineSummary> {
  if (marketId) {
    const market = markets.find((m) => m.id === marketId);

    if (!market) {
      throw new Error(`Unknown market: ${marketId}`);
    }

    return runSingleMarket(market);
  }

  return runChunkedPipeline(selfTriggerUrl);
}

// ─── Single-market run ──────────────────────────────────────────────────────

async function runSingleMarket(market: Market): Promise<PipelineSummary> {
  const env = getAnthropicEnv();
  const db = createSupabaseAdmin();
  const session = await createScoutSession(db);

  try {
    const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
    await insertSignals(db, session.id, signals);
    await sleep(phaseDelayMs);

    const rawIdeas = await generateIdeas(env.ANTHROPIC_API_KEY, market, signals, {
      maxSignals: maxSignalsPerMarket,
      useWebSearch: false
    });
    await sleep(phaseDelayMs);

    const scoredIdeas = await filterAndScoreIdeas(env.ANTHROPIC_API_KEY, rawIdeas);
    await insertIdeas(db, session.id, scoredIdeas);

    const killedPass1 = scoredIdeas.filter((i) => i.killed_at_pass === 1).length;
    const killedPass2 = scoredIdeas.filter((i) => i.killed_at_pass === 2).length;
    const survivorsCount = scoredIdeas.filter(
      (i) => i.killed_at_pass === null && (i.total_score ?? 0) >= 65
    ).length;

    await updateScoutSession(db, session.id, {
      markets_scanned: 1,
      ideas_generated: scoredIdeas.length,
      ideas_killed_p1: killedPass1,
      ideas_killed_p2: killedPass2,
      survivors: survivorsCount
    });

    const survivors = await loadSessionSurvivors(db, session.id);
    const topIdeas = survivors.slice(0, maxDeepDivesPerRun);

    const summary: PipelineSummary = {
      sessionId: session.id,
      marketsScanned: 1,
      ideasGenerated: scoredIdeas.length,
      killedPass1,
      killedPass2,
      survivors: survivors.length,
      posted: 0
    };

    await postMergedAnalysis(env.ANTHROPIC_API_KEY, db, topIdeas, summary);
    await updateScoutSession(db, session.id, { status: "done", survivors: survivors.length });

    return summary;
  } catch (error) {
    await updateScoutSession(db, session.id, { status: "failed" });
    throw error;
  }
}

// ─── Chunked full-pipeline run ──────────────────────────────────────────────

async function runChunkedPipeline(selfTriggerUrl: string): Promise<PipelineSummary> {
  const env = getAnthropicEnv();
  const db = createSupabaseAdmin();

  const existing = await findRunningSession(db);
  const session = existing ?? (await createScoutSession(db));

  let marketsScanned = session.markets_scanned;
  let ideasGenerated = session.ideas_generated;
  let killedPass1 = session.ideas_killed_p1;
  let killedPass2 = session.ideas_killed_p2;
  let survivorsCount = session.survivors;

  const chunkMarkets = markets.slice(marketsScanned, marketsScanned + CHUNK_SIZE);
  const telegram = createTelegramClient();
  const telegramChatId = getTelegramEnv().TELEGRAM_CHAT_ID;

  try {
    for (const market of chunkMarkets) {
      try {
        const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
        await insertSignals(db, session.id, signals);
        await sleep(phaseDelayMs);

        const rawIdeas = await generateIdeas(env.ANTHROPIC_API_KEY, market, signals, {
          maxSignals: maxSignalsPerMarket,
          useWebSearch: false
        });
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

        await telegram.sendMessage(
          telegramChatId,
          [
            "▶️ Прогресс анализа",
            `Рынок: ${market.name}`,
            `Готово рынков: ${marketsScanned}/${markets.length}`,
            `Идей: ${ideasGenerated}`,
            `Survivors: ${survivorsCount}`
          ].join("\n")
        );
      } catch (error) {
        console.error(`Market failed: ${market.id}`, error);
        marketsScanned += 1;
        await updateScoutSession(db, session.id, {
          markets_scanned: marketsScanned,
          ideas_generated: ideasGenerated,
          ideas_killed_p1: killedPass1,
          ideas_killed_p2: killedPass2,
          survivors: survivorsCount
        });
        await telegram.sendMessage(
          telegramChatId,
          [
            `⚠️ Рынок не обработан: ${market.name}`,
            error instanceof Error ? error.message : "Unknown error",
            `Пропускаю дальше: ${marketsScanned}/${markets.length}`
          ].join("\n")
        );
      }
    }

    const allMarketsProcessed = marketsScanned >= markets.length;

    if (!allMarketsProcessed) {
      await selfTrigger(selfTriggerUrl);
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

    const survivors = await loadSessionSurvivors(db, session.id);
    const topIdeas = survivors.slice(0, maxDeepDivesPerRun);

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
    await postMergedAnalysis(env.ANTHROPIC_API_KEY, db, topIdeas, summary);
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

// ─── Shared helpers ─────────────────────────────────────────────────────────

async function postMergedAnalysis(
  apiKey: string,
  db: ReturnType<typeof createSupabaseAdmin>,
  topIdeas: IdeaRecord[],
  summary: PipelineSummary
): Promise<void> {
  const withDeepDives: IdeaRecord[] = [];

  for (const idea of topIdeas) {
    try {
      const deepDive = await deepDiveIdea(apiKey, idea, { useWebSearch: false });
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
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("background", "1");

  return fetch(nextUrl.toString(), {
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
