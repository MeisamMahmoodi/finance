"use client";

import { useRef, useState } from "react";
import type { AiInsight, ChatMessage, PendingReview } from "@/lib/types";

export function AiFeed({
  insights,
  pendingReviews,
  initialMessages,
  onRefresh,
}: {
  insights: AiInsight[];
  pendingReviews: PendingReview[];
  initialMessages: ChatMessage[];
  onRefresh: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [reviews, setReviews] = useState<PendingReview[]>(pendingReviews);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const idCounter = useRef(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const userMsg: ChatMessage = {
      id: `local-${idCounter.current++}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${idCounter.current++}`,
          role: "assistant",
          content: data.reply ?? "Keine Antwort erhalten.",
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${idCounter.current++}`,
          role: "assistant",
          content: "Verbindung fehlgeschlagen, versuch es nochmal.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleAnswer(reviewId: string, answer: "yes" | "no") {
    setAnswering(reviewId);
    try {
      await fetch(`/api/reviews/${reviewId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      onRefresh();
    } finally {
      setAnswering(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-secondary mb-1 px-1">AI-Assistent</p>

      {reviews.map((r) => (
        <div key={r.id} className="bg-surface rounded-card p-3 flex flex-col gap-2.5 animate-[fadeIn_0.25s_ease]">
          <div className="flex gap-2.5 items-start">
            <Sparkle />
            <p className="text-sm leading-relaxed">{r.question}</p>
          </div>
          <div className="flex gap-2 pl-[26px]">
            <button
              onClick={() => handleAnswer(r.id, "yes")}
              disabled={answering === r.id}
              className="flex-1 h-9 rounded-full bg-accent text-bg text-xs font-medium disabled:opacity-50 transition-transform active:scale-95"
            >
              Ja, Vertrag
            </button>
            <button
              onClick={() => handleAnswer(r.id, "no")}
              disabled={answering === r.id}
              className="flex-1 h-9 rounded-full bg-bg border border-border text-xs font-medium disabled:opacity-50 transition-transform active:scale-95"
            >
              Nein
            </button>
          </div>
        </div>
      ))}

      {insights.map((i) => (
        <div key={i.id} className="bg-surface rounded-card p-3 flex gap-2.5 items-start">
          <Sparkle />
          <p className="text-sm leading-relaxed">{i.message}</p>
        </div>
      ))}

      {messages.map((m) => (
        <div
          key={m.id}
          className={`rounded-card p-3 text-sm leading-relaxed max-w-[88%] ${
            m.role === "user" ? "bg-accent text-bg self-end" : "bg-surface self-start flex gap-2.5 items-start"
          }`}
        >
          {m.role === "assistant" && <Sparkle />}
          <span>{m.content}</span>
        </div>
      ))}

      {insights.length === 0 && messages.length === 0 && reviews.length === 0 && (
        <p className="text-muted text-sm py-2 px-1">
          Frag mich etwas zu deinen Ausgaben, oder ich melde mich hier von selbst, sobald mir etwas auffällt.
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
          disabled={sending}
          aria-label="Senden"
          className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shrink-0 disabled:opacity-60 transition-transform active:scale-90"
        >
          {sending ? (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-bg border-t-transparent animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </form>
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
