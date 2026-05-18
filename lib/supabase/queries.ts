import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeepDive, IdeaRecord, ScoredIdea, ScoutSession, Signal } from "@/lib/scout/types";

type Db = SupabaseClient;

export async function createScoutSession(db: Db): Promise<ScoutSession> {
  const { data, error } = await db
    .from("scout_sessions")
    .insert({ date: new Date().toISOString().slice(0, 10), status: "running" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as ScoutSession;
}

export async function updateScoutSession(
  db: Db,
  id: string,
  patch: Partial<Omit<ScoutSession, "id" | "created_at">>
): Promise<void> {
  const { error } = await db.from("scout_sessions").update(patch).eq("id", id);

  if (error) {
    if (isMissingErrorMessageColumn(error) && "error_message" in patch) {
      const { error_message: _errorMessage, ...retryPatch } = patch;
      const retry = await db.from("scout_sessions").update(retryPatch).eq("id", id);

      if (!retry.error) {
        console.warn("scout_sessions.error_message column is missing; apply migration 003_session_error_message.sql.");
        return;
      }
    }

    throw error;
  }
}

export async function insertSignals(db: Db, sessionId: string, signals: Signal[]): Promise<void> {
  if (signals.length === 0) {
    return;
  }

  const { error } = await db.from("scout_signals").insert(
    signals.map((signal) => ({
      session_id: sessionId,
      market_id: signal.market_id,
      title: signal.title,
      source: signal.source,
      relevance_note: signal.relevance_note
    }))
  );

  if (error) {
    throw error;
  }
}

export async function insertIdeas(db: Db, sessionId: string, ideas: ScoredIdea[]): Promise<IdeaRecord[]> {
  if (ideas.length === 0) {
    return [];
  }

  const { data, error } = await db
    .from("scout_ideas")
    .insert(
      ideas.map((idea) => ({
        session_id: sessionId,
        market_id: idea.market_id,
        title: idea.title,
        description: idea.description,
        target_audience: idea.target_audience,
        monetization: idea.monetization,
        why_now: idea.why_now,
        signals_used: idea.signals_used,
        killed_at_pass: idea.killed_at_pass,
        kill_reason: idea.kill_reason,
        urgency_score: idea.urgency_score,
        timing_score: idea.timing_score,
        advantage_score: idea.advantage_score,
        monetization_score: idea.monetization_score,
        competition_score: idea.competition_score,
        mvp_speed_score: idea.mvp_speed_score,
        total_score: idea.total_score
      }))
    )
    .select("*");

  if (error) {
    throw error;
  }

  return data as IdeaRecord[];
}

export async function attachDeepDive(db: Db, ideaId: string, deepDive: DeepDive): Promise<IdeaRecord> {
  const { data, error } = await db
    .from("scout_ideas")
    .update({ deep_dive: deepDive })
    .eq("id", ideaId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as IdeaRecord;
}

export async function attachTelegramMessage(db: Db, ideaId: string, messageId: number): Promise<void> {
  const { error } = await db.from("scout_ideas").update({ telegram_message_id: messageId }).eq("id", ideaId);

  if (error) {
    throw error;
  }
}

export async function upsertVote(
  db: Db,
  ideaId: string,
  userId: number,
  username: string | null,
  vote: "fire" | "maybe" | "skip"
): Promise<void> {
  const { error } = await db.from("idea_votes").upsert(
    {
      idea_id: ideaId,
      telegram_user_id: userId,
      telegram_username: username,
      vote,
      voted_at: new Date().toISOString()
    },
    { onConflict: "idea_id,telegram_user_id" }
  );

  if (error) {
    throw error;
  }
}

export async function getVoteCounts(db: Db, ideaId: string): Promise<Record<"fire" | "maybe" | "skip", number>> {
  const { data, error } = await db.from("idea_votes").select("vote").eq("idea_id", ideaId);

  if (error) {
    throw error;
  }

  return {
    fire: data.filter((row) => row.vote === "fire").length,
    maybe: data.filter((row) => row.vote === "maybe").length,
    skip: data.filter((row) => row.vote === "skip").length
  };
}

export async function getIdea(db: Db, ideaId: string): Promise<IdeaRecord | null> {
  const { data, error } = await db.from("scout_ideas").select("*").eq("id", ideaId).maybeSingle();

  if (error) {
    throw error;
  }

  return data as IdeaRecord | null;
}

export async function listAnalyzedIdeas(db: Db, limit = 20): Promise<IdeaRecord[]> {
  const { data, error } = await db
    .from("scout_ideas")
    .select("*")
    .not("deep_dive", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as IdeaRecord[];
}

export async function listSessions(db: Db, limit = 50): Promise<ScoutSession[]> {
  const { data, error } = await db
    .from("scout_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data as ScoutSession[];
}

export async function failStaleZeroProgressSessions(db: Db, staleAfterMinutes = 8): Promise<number> {
  const cutoff = new Date(Date.now() - staleAfterMinutes * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("scout_sessions")
    .update({
      status: "failed",
      error_message: `Auto-cleanup: session had 0 markets and 0 ideas after ${staleAfterMinutes} minutes.`
    })
    .eq("status", "running")
    .eq("markets_scanned", 0)
    .eq("ideas_generated", 0)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    if (isMissingErrorMessageColumn(error)) {
      const retry = await db
        .from("scout_sessions")
        .update({ status: "failed" })
        .eq("status", "running")
        .eq("markets_scanned", 0)
        .eq("ideas_generated", 0)
        .lt("created_at", cutoff)
        .select("id");

      if (!retry.error) {
        console.warn("scout_sessions.error_message column is missing; apply migration 003_session_error_message.sql.");
        return retry.data?.length ?? 0;
      }
    }

    throw error;
  }

  return data?.length ?? 0;
}

function isMissingErrorMessageColumn(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    /error_message/i.test(error.message ?? "")
  );
}

export async function listSessionIdeas(db: Db, sessionId: string): Promise<IdeaRecord[]> {
  const { data, error } = await db
    .from("scout_ideas")
    .select("*")
    .eq("session_id", sessionId)
    .order("total_score", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return data as IdeaRecord[];
}

export async function getLatestSession(db: Db): Promise<ScoutSession | null> {
  const { data, error } = await db
    .from("scout_sessions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ScoutSession | null;
}

// Returns a running session started within the last 2 hours (avoids resuming stuck sessions from a previous day)
export async function findRunningSession(db: Db): Promise<ScoutSession | null> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("scout_sessions")
    .select("*")
    .eq("status", "running")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ScoutSession | null;
}

export async function loadSessionSurvivors(db: Db, sessionId: string): Promise<IdeaRecord[]> {
  const { data, error } = await db
    .from("scout_ideas")
    .select("*")
    .eq("session_id", sessionId)
    .is("killed_at_pass", null)
    .gte("total_score", 65)
    .order("total_score", { ascending: false });

  if (error) {
    throw error;
  }

  return data as IdeaRecord[];
}

export interface TotalStats {
  sessionCount: number;
  ideaCount: number;
  survivorCount: number;
  deepDiveCount: number;
}

export async function getTotalStats(db: Db): Promise<TotalStats> {
  const [sessionRes, ideaRes, survivorRes, deepDiveRes] = await Promise.all([
    db.from("scout_sessions").select("*", { count: "exact", head: true }),
    db.from("scout_ideas").select("*", { count: "exact", head: true }),
    db.from("scout_ideas").select("*", { count: "exact", head: true }).is("killed_at_pass", null),
    db.from("scout_ideas").select("*", { count: "exact", head: true }).not("deep_dive", "is", null)
  ]);

  return {
    sessionCount: sessionRes.count ?? 0,
    ideaCount: ideaRes.count ?? 0,
    survivorCount: survivorRes.count ?? 0,
    deepDiveCount: deepDiveRes.count ?? 0
  };
}

export async function getVoteCountsForIdeas(
  db: Db,
  ideaIds: string[]
): Promise<Map<string, Record<"fire" | "maybe" | "skip", number>>> {
  const map = new Map<string, Record<"fire" | "maybe" | "skip", number>>();

  if (ideaIds.length === 0) {
    return map;
  }

  for (const id of ideaIds) {
    map.set(id, { fire: 0, maybe: 0, skip: 0 });
  }

  const { data, error } = await db.from("idea_votes").select("idea_id, vote").in("idea_id", ideaIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const counts = map.get(row.idea_id as string);

    if (counts && (row.vote === "fire" || row.vote === "maybe" || row.vote === "skip")) {
      counts[row.vote as "fire" | "maybe" | "skip"]++;
    }
  }

  return map;
}

export async function claimTelegramUpdate(
  db: Db,
  updateId: number,
  updateKind: "message" | "callback_query"
): Promise<boolean> {
  const { error } = await db.from("telegram_update_runs").insert({
    telegram_update_id: updateId,
    update_kind: updateKind,
    status: "running"
  });

  if (!error) {
    return true;
  }

  if (error.code === "23505") {
    return false;
  }

  if (error.code === "42P01") {
    console.warn("telegram_update_runs table is missing; skipping Telegram update dedupe until migration 002 is applied.");
    return true;
  }

  throw error;
}

export async function finishTelegramUpdate(
  db: Db,
  updateId: number,
  status: "done" | "failed",
  errorMessage?: string
): Promise<void> {
  const { error } = await db
    .from("telegram_update_runs")
    .update({
      status,
      error_message: errorMessage ?? null,
      finished_at: new Date().toISOString()
    })
    .eq("telegram_update_id", updateId);

  if (error?.code === "42P01") {
    return;
  }

  if (error) {
    throw error;
  }
}
