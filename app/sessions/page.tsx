import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { listSessions } from "@/lib/supabase/queries";
import type { ScoutSession } from "@/lib/scout/types";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const db = createSupabaseAdmin();
  const sessions = await listSessions(db);

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">
          ← Dashboard
        </Link>
        <h1 className="font-bold text-xl">Всі запуски</h1>
        <span className="text-gray-400 text-sm ml-auto">{sessions.length} сесій</span>
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-400 text-sm">Ще не було жодного запуску.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Дата</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-right px-4 py-3">Ринки</th>
                <th className="text-right px-4 py-3">Ідеї</th>
                <th className="text-right px-4 py-3">Відсіяно</th>
                <th className="text-right px-4 py-3">Вижило</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function SessionRow({ session: s }: { session: ScoutSession }) {
  const killed = (s.ideas_killed_p1 ?? 0) + (s.ideas_killed_p2 ?? 0);

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-gray-700">{s.date}</td>
      <td className="px-4 py-3">
        <StatusBadge status={s.status} />
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
        {s.markets_scanned}
        <span className="text-gray-300">/12</span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600">{s.ideas_generated}</td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-400">{killed}</td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-800">{s.survivors}</td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/sessions/${s.id}`}
          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
        >
          Деталі →
        </Link>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: ScoutSession["status"] }) {
  const map: Record<ScoutSession["status"], { label: string; cls: string }> = {
    running: { label: "🔄 Виконується", cls: "text-blue-600" },
    done: { label: "✅ Завершено", cls: "text-green-600" },
    failed: { label: "❌ Помилка", cls: "text-red-500" }
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}
