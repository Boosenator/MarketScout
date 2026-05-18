import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { getVoteCountsForIdeas, listAnalyzedIdeas } from "@/lib/supabase/queries";
import { markets } from "@/lib/scout/markets";
import IdeaCard from "../components/IdeaCard";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { market?: string; sort?: string };
}

export default async function IdeasPage({ searchParams }: Props) {
  const db = createSupabaseAdmin();
  const ideas = await listAnalyzedIdeas(db, 100);

  const marketFilter = searchParams.market ?? "";
  const sort = searchParams.sort ?? "score";

  const filtered = marketFilter ? ideas.filter((i) => i.market_id === marketFilter) : ideas;
  const sorted = [...filtered].sort((a, b) =>
    sort === "score"
      ? (b.total_score ?? 0) - (a.total_score ?? 0)
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const votesMap = await getVoteCountsForIdeas(db, sorted.map((i) => i.id));

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-gray-400 hover:text-gray-700 text-sm">
          ← Dashboard
        </Link>
        <h1 className="font-bold text-xl">Всі ідеї</h1>
        <span className="text-gray-400 text-sm ml-auto">{sorted.length} результатів</span>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <FilterLink href="/ideas" label="Всі ринки" active={!marketFilter} />
        {markets.map((m) => (
          <FilterLink
            key={m.id}
            href={`/ideas?market=${m.id}${sort !== "score" ? `&sort=${sort}` : ""}`}
            label={m.name}
            active={marketFilter === m.id}
          />
        ))}
      </div>

      <div className="flex gap-2 text-sm">
        <span className="text-gray-500">Сортування:</span>
        <SortLink href={`/ideas${marketFilter ? `?market=${marketFilter}` : ""}`} label="За скором" active={sort === "score"} />
        <SortLink
          href={`/ideas?sort=date${marketFilter ? `&market=${marketFilter}` : ""}`}
          label="За датою"
          active={sort === "date"}
        />
      </div>

      {/* Ideas */}
      {sorted.length === 0 ? (
        <p className="text-gray-400 text-sm">Немає ідей для цього фільтру.</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              votes={votesMap.get(idea.id) ?? { fire: 0, maybe: 0, skip: 0 }}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-gray-600 border-gray-200 hover:border-indigo-400"
      }`}
    >
      {label}
    </Link>
  );
}

function SortLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} className={active ? "font-semibold text-indigo-600" : "text-gray-500 hover:text-gray-800"}>
      {label}
    </Link>
  );
}
