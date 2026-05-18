import Link from "next/link";
import { markets } from "@/lib/scout/markets";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import {
  getTotalStats,
  getVoteCountsForIdeas,
  listAnalyzedIdeas,
  listSessions
} from "@/lib/supabase/queries";
import type { ScoutSession } from "@/lib/scout/types";
import IdeaCard from "./components/IdeaCard";
import RunButton from "./components/RunButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const db = createSupabaseAdmin();
  const [sessions, stats, allIdeas] = await Promise.all([
    listSessions(db, 5),
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

      {/* Recent sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-base">Останні запуски</h2>
          <Link href="/sessions" className="text-sm text-indigo-600 hover:underline">
            Всі запуски →
          </Link>
        </div>

        {sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">Ще не було жодного запуску.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {sessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Top ideas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Топ ідеї</h2>
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

function SessionRow({ session: s }: { session: ScoutSession }) {
  const killed = (s.ideas_killed_p1 ?? 0) + (s.ideas_killed_p2 ?? 0);

  const statusIcon: Record<ScoutSession["status"], string> = {
    running: "🔄",
    done: "✅",
    failed: "❌"
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-gray-700 text-sm">{s.date}</td>
      <td className="px-4 py-3 text-base">{statusIcon[s.status]}</td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {s.markets_scanned}<span className="text-gray-300">/12</span> ринків
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{s.ideas_generated} ідей</td>
      <td className="px-4 py-3 text-sm text-gray-400">{killed} відсіяно</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.survivors} вижило</td>
      <td className="px-4 py-3 text-right">
        <Link href={`/sessions/${s.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
          Деталі →
        </Link>
      </td>
    </tr>
  );
}
