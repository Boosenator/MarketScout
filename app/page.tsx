import { markets } from "@/lib/scout/markets";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  failStaleZeroProgressSessions,
  getTotalStats,
  getVoteCountsForIdeas,
  listAnalyzedIdeas,
  listSessions
} from "@/lib/supabase/queries";
import DashboardClient, { type DashboardData } from "./components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = createSupabaseAdmin();
  await failStaleZeroProgressSessions(db);

  const [sessions, stats, allIdeas] = await Promise.all([
    listSessions(db, 5),
    getTotalStats(db),
    listAnalyzedIdeas(db, 30)
  ]);

  const topIdeas = [...allIdeas].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)).slice(0, 10);
  const votesMap = await getVoteCountsForIdeas(db, topIdeas.map((idea) => idea.id));

  const initialData: DashboardData = {
    sessions,
    stats,
    topIdeas: topIdeas.map((idea) => ({
      ...idea,
      votes: votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 }
    })),
    generatedAt: new Date().toISOString()
  };

  return <DashboardClient initialData={initialData} markets={markets.map((market) => ({ id: market.id, name: market.name }))} />;
}
