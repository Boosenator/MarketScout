"use client";

import { useState } from "react";

type State = "idle" | "loading" | "done" | "error";

export default function PostToTelegramButton({ ideaId }: { ideaId: string }) {
  const [state, setState] = useState<State>("idle");

  async function handlePost() {
    if (state !== "idle") return;
    setState("loading");

    try {
      const res = await fetch(`/api/ideas/${ideaId}/post`, { method: "POST" });
      const body = (await res.json()) as { ok: boolean; error?: string };
      setState(body.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <span className="text-xs text-green-600 font-medium">✓ Відправлено</span>;
  }

  if (state === "error") {
    return <span className="text-xs text-red-500">✗ Помилка</span>;
  }

  return (
    <button
      onClick={handlePost}
      disabled={state === "loading"}
      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 transition-colors"
    >
      {state === "loading" ? "Відправляю..." : "📤 Закинуть команді"}
    </button>
  );
}
