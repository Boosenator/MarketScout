"use client";

import { useState } from "react";

type State = "idle" | "loading" | "started" | "error";

export default function RunButton() {
  const [state, setState] = useState<State>("idle");

  async function handleRun() {
    if (state === "loading") return;
    setState("loading");

    try {
      const res = await fetch("/api/run", { method: "POST" });
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

  const label: Record<State, string> = {
    idle: "▶ Запустити аналіз",
    loading: "Запускаю...",
    started: "✓ Запущено",
    error: "✗ Помилка"
  };

  const cls: Record<State, string> = {
    idle: "bg-indigo-600 hover:bg-indigo-700 text-white",
    loading: "bg-indigo-400 text-white cursor-not-allowed",
    started: "bg-green-600 text-white",
    error: "bg-red-600 text-white"
  };

  return (
    <button
      onClick={handleRun}
      disabled={state === "loading"}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cls[state]}`}
    >
      {label[state]}
    </button>
  );
}
