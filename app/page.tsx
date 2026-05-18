import Link from "next/link";
import { markets, getMarketName } from "@/lib/scout/markets";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  getLatestSession,
  getTotalStats,
  getVoteCountsForIdeas,
  listAnalyzedIdeas
} from "@/lib/supabase/queries";
import type { ScoutSession } from "@/lib/scout/types";
import IdeaCard from "./components/IdeaCard";
import RunButton from "./components/RunButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = createSupabaseAdmin();
  const [session, stats, allIdeas] = await Promise.all([
    getLatestSession(db),
    getTotalStats(db),
    listAnalyzedIdeas(db, 30)
  ]);

  const topIdeas = [...allIdeas].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)).slice(0, 10);
  const votesMap = await getVoteCountsForIdeas(db, topIdeas.map((i) => i.id));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MarketScout</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI Market Intelligence · 12 ринків</p>
        </div>
        <RunButton markets={markets.map((m) => ({ id: m.id, name: m.name }))} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Сесій" value={stats.sessionCount} />
        <StatCard label="Ідей" value={stats.ideaCount} />
        <StatCard label="Вижило" value={stats.survivorCount} />
        <StatCard label="Deep dive" value={stats.deepDiveCount} />
      </div>

      {/* Latest session */}
      {session && <SessionCard session={session} />}

      {/* Top ideas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Топ ідеї</h2>
          <Link href="/ideas" className="text-sm text-indigo-600 hover:underline">
            Всі ідеї →
          </Link>
        </div>

        {topIdeas.length === 0 ? (
          <p className="text-gray-400 text-sm">Поки немає результатів. Запусти аналіз.</p>
        ) : (
          <div className="space-y-4">
            {topIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                votes={votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 }}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function SessionCard({ session }: { session: ScoutSession }) {
  const statusConfig: Record<ScoutSession["status"], { label: string; cls: string; dot?: string }> = {
    running: {
      label: "Виконується",
      cls: "bg-blue-50 border-blue-200",
      dot: "bg-blue-500 animate-pulse"
    },
    done: { label: "Завершено", cls: "bg-green-50 border-green-200" },
    failed: { label: "Помилка", cls: "bg-red-50 border-red-200" }
  };

  const { label, cls, dot } = statusConfig[session.status];

  return (
    <div className={`border rounded-xl p-4 ${cls}`}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">Остання сесія · {session.date}</span>
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {dot && <span className={`w-2 h-2 rounded-full ${dot}`} />}
          {label}
        </span>
      </div>
      <div className="mt-2 flex gap-5 text-sm text-gray-600">
        <span>🌍 {session.markets_scanned}/12 ринків</span>
        <span>💡 {session.ideas_generated} ідей</span>
        <span>
          ❌ {(session.ideas_killed_p1 ?? 0) + (session.ideas_killed_p2 ?? 0)} відсіяно
        </span>
        <span>✨ {session.survivors} вижило</span>
      </div>
    </div>
  );
}
