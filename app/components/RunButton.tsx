"use client";

import { useState } from "react";

export interface MarketOption {
  id: string;
  name: string;
}

type State = "idle" | "loading" | "started" | "error";

interface Props {
  markets: MarketOption[];
}

export default function RunButton({ markets }: Props) {
  const [state, setState] = useState<State>("idle");
  const [marketId, setMarketId] = useState("");

  async function handleRun() {
    if (state === "loading") return;
    setState("loading");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(marketId ? { marketId } : {})
      });
      const body = (await res.json()) as { ok: boolean; error?: string };

      if (!body.ok) {
        console.error("Run failed:", body.error);
        setState("error");
        setTimeout(() => setState("idle"), 4000);
        return;
      }

      setState("started");
      setTimeout(() => setState("idle"), 6000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 4000);
    }
  }

  const btnLabel: Record<State, string> = {
    idle: "▶ Запустити",
    loading: "Запускаю...",
    started: "✓ Запущено",
    error: "✗ Помилка"
  };

  const btnCls: Record<State, string> = {
    idle: "bg-indigo-600 hover:bg-indigo-700 text-white",
    loading: "bg-indigo-400 text-white cursor-not-allowed",
    started: "bg-green-600 text-white",
    error: "bg-red-600 text-white"
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={marketId}
        onChange={(e) => setMarketId(e.target.value)}
        disabled={state === "loading"}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-50"
      >
        <option value="">Всі ринки</option>
        {markets.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <button
        onClick={handleRun}
        disabled={state === "loading"}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${btnCls[state]}`}
      >
        {btnLabel[state]}
      </button>
    </div>
  );
}
