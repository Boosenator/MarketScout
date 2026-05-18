import Link from "next/link";
import { notFound } from "next/navigation";
import { getMarketName } from "@/lib/scout/markets";
import type { IdeaRecord, ScoutSession } from "@/lib/scout/types";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { getVoteCountsForIdeas, listSessionIdeas } from "@/lib/supabase/queries";
import IdeaCard from "@/app/components/IdeaCard";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function SessionDetailPage({ params }: Props) {
  const db = createSupabaseAdmin();

  const [sessionRes, ideas] = await Promise.all([
    db.from("scout_sessions").select("*").eq("id", params.id).maybeSingle(),
    listSessionIdeas(db, params.id)
  ]);

  if (!sessionRes.data) {
    notFound();
  }

  const session = sessionRes.data as ScoutSession;
  const survived = ideas.filter((i) => i.killed_at_pass === null);
  const killedP2 = ideas.filter((i) => i.killed_at_pass === 2);
  const killedP1 = ideas.filter((i) => i.killed_at_pass === 1);

  const survivedIds = survived.map((i) => i.id);
  const votesMap = survivedIds.length > 0 ? await getVoteCountsForIdeas(db, survivedIds) : new Map();

  const killed = (session.ideas_killed_p1 ?? 0) + (session.ideas_killed_p2 ?? 0);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/sessions" className="text-gray-400 hover:text-gray-700 text-sm">
            ← Всі запуски
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-bold text-lg">{session.date}</span>
              <span className="ml-2 text-xs text-gray-400 font-mono">{session.id.slice(0, 8)}</span>
            </div>
            <StatusChip status={session.status} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Stat label="Ринків" value={`${session.markets_scanned}/12`} />
            <Stat label="Ідей згенеровано" value={session.ideas_generated} />
            <Stat label="Відсіяно" value={killed} />
            <Stat label="Вижило" value={session.survivors} accent />
          </div>

          {session.ideas_killed_p1 > 0 || session.ideas_killed_p2 > 0 ? (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex gap-4">
              <span>Kill criteria (pass 1): {session.ideas_killed_p1 ?? 0}</span>
              <span>Низький score (pass 2): {session.ideas_killed_p2 ?? 0}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Survived */}
      {survived.length > 0 && (
        <Section title="✨ Вижили" count={survived.length}>
          {survived.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              votes={votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 }}
            />
          ))}
        </Section>
      )}

      {/* Killed pass 2 */}
      {killedP2.length > 0 && (
        <Section title="📉 Відфільтровано (низький score)" count={killedP2.length}>
          {killedP2.map((idea) => (
            <KilledIdeaRow key={idea.id} idea={idea} />
          ))}
        </Section>
      )}

      {/* Killed pass 1 */}
      {killedP1.length > 0 && (
        <Section title="🚫 Відхилено (kill criteria)" count={killedP1.length}>
          {killedP1.map((idea) => (
            <KilledIdeaRow key={idea.id} idea={idea} />
          ))}
        </Section>
      )}

      {ideas.length === 0 && (
        <p className="text-gray-400 text-sm">Ідей не знайдено для цієї сесії.</p>
      )}
    </main>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-base flex items-center gap-2">
        {title}
        <span className="text-sm text-gray-400 font-normal">({count})</span>
      </h2>
      {children}
    </section>
  );
}

function KilledIdeaRow({ idea }: { idea: IdeaRecord }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs text-gray-400">{getMarketName(idea.market_id)}</div>
        {idea.total_score !== null && (
          <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
            {idea.total_score}/100
          </span>
        )}
      </div>
      <p className="font-medium text-sm text-gray-700">{idea.title}</p>
      {idea.kill_reason && (
        <p className="text-xs text-red-500">↳ {idea.kill_reason}</p>
      )}
      {idea.killed_at_pass === 2 && idea.total_score !== null && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 pt-0.5">
          {idea.urgency_score !== null && <span>urgency {idea.urgency_score}</span>}
          {idea.timing_score !== null && <span>timing {idea.timing_score}</span>}
          {idea.advantage_score !== null && <span>advantage {idea.advantage_score}</span>}
          {idea.competition_score !== null && <span>competition {idea.competition_score}</span>}
          {idea.mvp_speed_score !== null && <span>mvp speed {idea.mvp_speed_score}</span>}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: ScoutSession["status"] }) {
  const map: Record<ScoutSession["status"], { label: string; cls: string }> = {
    running: { label: "🔄 Виконується", cls: "bg-blue-50 text-blue-700" },
    done: { label: "✅ Завершено", cls: "bg-green-50 text-green-700" },
    failed: { label: "❌ Помилка", cls: "bg-red-50 text-red-600" }
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div>
      <div className={`text-xl font-bold tabular-nums ${accent ? "text-indigo-600" : "text-gray-800"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
