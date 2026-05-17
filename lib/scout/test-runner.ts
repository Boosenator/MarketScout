import { getAnthropicEnv } from "@/lib/config";
import { getMarketName, markets } from "@/lib/scout/markets";
import { scoutMarketSignals } from "@/lib/scout/phase1-search";
import { generateIdeas } from "@/lib/scout/phase2-generate";
import { filterAndScoreIdeas } from "@/lib/scout/phase2-filter";
import { deepDiveIdea } from "@/lib/scout/phase3-deepdive";
import type { DeepDive, IdeaRecord, Market, RawIdea, ScoredIdea, Signal } from "@/lib/scout/types";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  attachDeepDive,
  createScoutSession,
  insertIdeas,
  insertSignals,
  updateScoutSession
} from "@/lib/supabase/queries";
import { formatIdeaPost } from "@/lib/telegram/post-idea";

export type PhaseName = "phase1" | "phase2" | "phase3" | "all";

export interface Phase1TestResult {
  sessionId: string;
  market: Market;
  signals: Signal[];
}

export interface Phase2TestResult extends Phase1TestResult {
  rawIdeas: RawIdea[];
  scoredIdeas: ScoredIdea[];
  savedIdeas: IdeaRecord[];
}

export interface Phase3TestResult extends Phase2TestResult {
  selectedIdea: IdeaRecord | null;
  deepDive: DeepDive | null;
}

export function findMarket(marketId: string): Market | null {
  const normalized = marketId.trim().toLowerCase();
  return markets.find((market) => market.id === normalized) ?? null;
}

export function marketListText(): string {
  return markets.map((market) => `${market.id} - ${market.name}`).join("\n");
}

export async function runPhase1Test(marketId: string): Promise<Phase1TestResult> {
  const env = getAnthropicEnv();
  const market = requireMarket(marketId);
  const db = createSupabaseAdmin();
  const session = await createScoutSession(db);

  try {
    const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
    await insertSignals(db, session.id, signals);
    await updateScoutSession(db, session.id, {
      markets_scanned: 1,
      status: "done"
    });

    return { sessionId: session.id, market, signals };
  } catch (error) {
    await updateScoutSession(db, session.id, { status: "failed" });
    throw error;
  }
}

export async function runPhase2Test(marketId: string): Promise<Phase2TestResult> {
  const env = getAnthropicEnv();
  const market = requireMarket(marketId);
  const db = createSupabaseAdmin();
  const session = await createScoutSession(db);

  try {
    const signals = await scoutMarketSignals(env.ANTHROPIC_API_KEY, market);
    await insertSignals(db, session.id, signals);

    const rawIdeas = await generateIdeas(env.ANTHROPIC_API_KEY, market, signals);
    const scoredIdeas = await filterAndScoreIdeas(env.ANTHROPIC_API_KEY, rawIdeas);
    const savedIdeas = await insertIdeas(db, session.id, scoredIdeas);

    await updateScoutSession(db, session.id, {
      markets_scanned: 1,
      ideas_generated: scoredIdeas.length,
      ideas_killed_p1: scoredIdeas.filter((idea) => idea.killed_at_pass === 1).length,
      ideas_killed_p2: scoredIdeas.filter((idea) => idea.killed_at_pass === 2).length,
      survivors: survivors(scoredIdeas).length,
      status: "done"
    });

    return { sessionId: session.id, market, signals, rawIdeas, scoredIdeas, savedIdeas };
  } catch (error) {
    await updateScoutSession(db, session.id, { status: "failed" });
    throw error;
  }
}

export async function runPhase3Test(marketId: string): Promise<Phase3TestResult> {
  const phase2 = await runPhase2Test(marketId);
  const env = getAnthropicEnv();
  const db = createSupabaseAdmin();
  const selectedIdea = phase2.savedIdeas
    .filter((idea) => idea.killed_at_pass === null && (idea.total_score ?? 0) >= 65)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))[0];

  if (!selectedIdea) {
    return { ...phase2, selectedIdea: null, deepDive: null };
  }

  const deepDive = await deepDiveIdea(env.ANTHROPIC_API_KEY, selectedIdea);
  await attachDeepDive(db, selectedIdea.id, deepDive);

  return { ...phase2, selectedIdea, deepDive };
}

export function summarizePhase1(result: Phase1TestResult): string {
  const topSignals = result.signals
    .slice(0, 5)
    .map((signal, index) => `${index + 1}. ${signal.title} (${signal.source})`)
    .join("\n");

  return [
    `Phase 1 готова: ${getMarketName(result.market.id)}`,
    `Сессия: ${result.sessionId}`,
    `Сигналов: ${result.signals.length}`,
    "",
    topSignals
  ].join("\n");
}

export function summarizePhase2(result: Phase2TestResult): string {
  const killed = result.scoredIdeas.filter((idea) => idea.killed_at_pass !== null).length;
  const alive = survivors(result.scoredIdeas);
  const topIdeas = alive
    .slice(0, 5)
    .map((idea, index) => `${index + 1}. ${idea.title} - ${idea.total_score ?? 0}/100`)
    .join("\n");
  const killedIdeas = result.scoredIdeas
    .filter((idea) => idea.killed_at_pass !== null)
    .slice(0, 5)
    .map((idea, index) => `${index + 1}. ${idea.title}: ${idea.kill_reason ?? "no reason"}`)
    .join("\n");
  const lowScoreIdeas = result.scoredIdeas
    .filter((idea) => idea.killed_at_pass === null)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
    .slice(0, 5)
    .map((idea, index) => `${index + 1}. ${idea.title} - ${idea.total_score ?? 0}/100`)
    .join("\n");

  return [
    `Phase 2 готова: ${getMarketName(result.market.id)}`,
    `Сессия: ${result.sessionId}`,
    `Сигналов: ${result.signals.length}`,
    `Сырых идей: ${result.rawIdeas.length}`,
    `Оценено идей: ${result.scoredIdeas.length}`,
    `Отсеяно: ${killed}`,
    `Прошло >=65: ${alive.length}`,
    "",
    topIdeas || "Нет идей выше порога.",
    alive.length === 0 && lowScoreIdeas ? `\nЛучшие неубитые идеи:\n${lowScoreIdeas}` : "",
    alive.length === 0 && killedIdeas ? `\nПричины отсева:\n${killedIdeas}` : ""
  ].join("\n");
}

export function summarizePhase3(result: Phase3TestResult): string {
  if (!result.selectedIdea || !result.deepDive) {
    return `${summarizePhase2(result)}\n\nPhase 3 пропущена: нет идей со score >= 65.`;
  }

  return `${formatIdeaPost({ ...result.selectedIdea, deep_dive: result.deepDive })}\n\nСессия: ${result.sessionId}`;
}

function requireMarket(marketId: string): Market {
  const market = findMarket(marketId);

  if (!market) {
    throw new Error(`Unknown market "${marketId}". Use /markets to see available ids.`);
  }

  return market;
}

function survivors(ideas: ScoredIdea[]): ScoredIdea[] {
  return ideas
    .filter((idea) => idea.killed_at_pass === null && (idea.total_score ?? 0) >= 65)
    .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
}
