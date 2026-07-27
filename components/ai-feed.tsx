"use client";

import { useState } from "react";
import type { AiInsight } from "@/lib/types";

export function AiFeed({ insights }: { insights: AiInsight[] }) {
  const [input, setInput] = useState("");
  const [note, setNote] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setNote("Chat-Assistent kommt in Phase 3 (Gemini-Anbindung).");
    setInput("");
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-secondary mb-1 px-1">AI-Feed</p>

      {insights.map((i) => (
        <div
          key={i.id}
          className="bg-surface rounded-card p-3 flex gap-2.5 items-start"
        >
          <Sparkle />
          <p className="text-sm leading-relaxed">{i.message}</p>
        </div>
      ))}
      {insights.length === 0 && (
        <p className="text-muted text-sm py-2 px-1">
          Noch keine Analysen — sobald Daten da sind, meldet sich die KI hier.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 mt-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frag etwas zu deinen Ausgaben..."
          className="flex-1 h-11 rounded-full bg-surface border border-border px-4 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          aria-label="Senden"
          className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </form>
      {note && <p className="text-muted text-xs px-1">{note}</p>}
    </div>
  );
}

function Sparkle() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#111113"
      strokeWidth="1.8"
      className="mt-0.5 shrink-0"
    >
      <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" />
    </svg>
  );
}
