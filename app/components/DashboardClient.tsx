"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { IdeaRecord, ScoutSession } from "@/lib/scout/types";
import type { TotalStats } from "@/lib/supabase/queries";
import IdeaCard from "./IdeaCard";
import RunButton, { type MarketOption } from "./RunButton";

type VoteCounts = Record<"fire" | "maybe" | "skip", number>;

export interface DashboardIdea extends IdeaRecord {
  votes: VoteCounts;
}

export interface DashboardData {
  sessions: ScoutSession[];
  stats: TotalStats;
  topIdeas: DashboardIdea[];
  generatedAt: string;
}

interface Props {
  initialData: DashboardData;
  markets: MarketOption[];
}

export default function DashboardClient({ initialData, markets }: Props) {
  const [data, setData] = useState(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRunningSession = useMemo(() => data.sessions.some((session) => session.status === "running"), [data.sessions]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refresh() {
      try {
        setRefreshing(true);
        const res = await fetch("/api/dashboard", { cache: "no-store" });

        if (!res.ok) {
          throw new Error(`Dashboard refresh failed: ${res.status}`);
        }

        const nextData = (await res.json()) as DashboardData;

        if (!cancelled) {
          setData(nextData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Не вдалося оновити дані");
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false);
          timer = setTimeout(refresh, hasRunningSession ? 3000 : 12000);
        }
      }
    }

    timer = setTimeout(refresh, hasRunningSession ? 1500 : 12000);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [hasRunningSession]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">MarketScout</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI Market Intelligence · 12 ринків</p>
        </div>
        <RunButton markets={markets} />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Сесій" value={data.stats.sessionCount} />
        <StatCard label="Ідей" value={data.stats.ideaCount} />
        <StatCard label="Вижило" value={data.stats.survivorCount} />
        <StatCard label="Deep dive" value={data.stats.deepDiveCount} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-base">Останні запуски</h2>
            <LiveStatus running={hasRunningSession} refreshing={refreshing} error={error} updatedAt={data.generatedAt} />
          </div>
          <Link href="/sessions" className="text-sm text-indigo-600 hover:underline">
            Всі запуски →
          </Link>
        </div>

        {data.sessions.length === 0 ? (
          <p className="text-gray-400 text-sm">Ще не було жодного запуску.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {data.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-base">Топ ідей</h2>
          <Link href="/ideas" className="text-sm text-indigo-600 hover:underline">
            Всі ідеї →
          </Link>
        </div>

        {data.topIdeas.length === 0 ? (
          <p className="text-gray-400 text-sm">Поки немає результатів. Запусти аналіз.</p>
        ) : (
          <div className="space-y-4">
            {data.topIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} votes={idea.votes} />
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

function SessionRow({ session }: { session: ScoutSession }) {
  const killed = (session.ideas_killed_p1 ?? 0) + (session.ideas_killed_p2 ?? 0);
  const isRunning = session.status === "running";

  return (
    <tr className={isRunning ? "bg-indigo-50/40" : "hover:bg-gray-50 transition-colors"}>
      <td className="px-4 py-3 font-mono text-gray-700 text-sm">{session.date}</td>
      <td className="px-4 py-3">
        <StatusBadge status={session.status} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {session.markets_scanned}<span className="text-gray-300">/12</span> ринків
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{session.ideas_generated} ідей</td>
      <td className="px-4 py-3 text-sm text-gray-400">{killed} відсіяно</td>
      <td className="px-4 py-3 text-sm font-medium text-gray-800">{session.survivors} вижило</td>
      <td className="px-4 py-3 text-right">
        <Link href={`/sessions/${session.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
          Деталі →
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ScoutSession["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700">
        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        в роботі
      </span>
    );
  }

  if (status === "failed") {
    return <span className="text-xs font-medium text-red-600">помилка</span>;
  }

  return <span className="text-xs font-medium text-green-700">готово</span>;
}

function LiveStatus({
  running,
  refreshing,
  error,
  updatedAt
}: {
  running: boolean;
  refreshing: boolean;
  error: string | null;
  updatedAt: string;
}) {
  if (error) {
    return <span className="text-xs text-red-500">{error}</span>;
  }

  if (running) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600">
        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
        live
      </span>
    );
  }

  const time = new Date(updatedAt).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  return <span className="text-xs text-gray-400">{refreshing ? "оновлюю..." : `оновлено ${time}`}</span>;
}
