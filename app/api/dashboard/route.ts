import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  getTotalStats,
  getVoteCountsForIdeas,
  listAnalyzedIdeas,
  listSessions
} from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const db = createSupabaseAdmin();
  const [sessions, stats, allIdeas] = await Promise.all([
    listSessions(db, 5),
    getTotalStats(db),
    listAnalyzedIdeas(db, 30)
  ]);

  const topIdeas = [...allIdeas].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)).slice(0, 10);
  const votesMap = await getVoteCountsForIdeas(db, topIdeas.map((idea) => idea.id));

  return NextResponse.json({
    sessions,
    stats,
    topIdeas: topIdeas.map((idea) => ({
      ...idea,
      votes: votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 }
    })),
    generatedAt: new Date().toISOString()
  }, {
    headers: {
      "cache-control": "no-store, max-age=0"
    }
  });
}
