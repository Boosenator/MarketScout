"use client";

import { useCallback, useState } from "react";

interface Counts {
  fire: number;
  maybe: number;
  skip: number;
}

interface Props {
  ideaId: string;
  initial: Counts;
}

export default function VoteCounts({ ideaId, initial }: Props) {
  const [counts, setCounts] = useState<Counts>(initial);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/ideas/${ideaId}/votes`);
      const data = (await res.json()) as Counts;
      setCounts(data);
    } finally {
      setRefreshing(false);
    }
  }, [ideaId]);

  return (
    <span className="flex items-center gap-3">
      <span className="flex items-center gap-1 text-gray-500">
        🔥 <span className="font-medium text-gray-700">{counts.fire}</span>
      </span>
      <span className="flex items-center gap-1 text-gray-500">
        🤔 <span className="font-medium text-gray-700">{counts.maybe}</span>
      </span>
      <span className="flex items-center gap-1 text-gray-500">
        👎 <span className="font-medium text-gray-700">{counts.skip}</span>
      </span>
      <button
        onClick={refresh}
        disabled={refreshing}
        title="Оновити голоси"
        className="text-gray-300 hover:text-gray-500 disabled:opacity-40 transition-colors text-base leading-none"
      >
        ↻
      </button>
    </span>
  );
}
