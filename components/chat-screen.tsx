"use client";

import { useEffect, useRef, useState } from "react";
import type { AiInsight, ChatMessage, PendingReview } from "@/lib/types";

function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const commaIdx = result.indexOf(",");
      resolve({ data: result.slice(commaIdx + 1), mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatScreen({
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
  const [visibleInsights, setVisibleInsights] = useState<AiInsight[]>(insights);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ data: string; mimeType: string; previewUrl: string } | null>(
    null,
  );
  const idCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Beim Öffnen des Chat-Tabs und nach jeder neuen Nachricht direkt ans Ende
  // springen, statt mitten in der (teils langen) Verlaufshistorie zu landen.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleDismissInsight(id: string) {
    setDismissing(id);
    setVisibleInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/insights/${id}/dismiss`, { method: "PATCH" });
    } finally {
      setDismissing(null);
    }
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const { data, mimeType } = await fileToBase64(file);
    setPendingImage({ data, mimeType, previewUrl: URL.createObjectURL(file) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    const image = pendingImage;
    if ((!text && !image) || sending) return;
    setInput("");
    setPendingImage(null);
    setSending(true);

    const userMsg: ChatMessage = {
      id: `local-${idCounter.current++}`,
      role: "user",
      content: text || (image ? "📷 Foto gesendet" : ""),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          image: image ? { data: image.data, mimeType: image.mimeType } : undefined,
        }),
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
      onRefresh();
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

  const isEmpty = visibleInsights.length === 0 && messages.length === 0 && reviews.length === 0;

  return (
    <div className="pb-28 min-h-dvh flex flex-col">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-sm font-medium">AI-Assistent</h1>
        <p className="text-muted text-xs mt-0.5">Fragen zu deinen Finanzen, Rückfragen zu Verträgen/Abos</p>
      </div>

      <div className="flex-1 px-4 flex flex-col gap-2 mt-2">
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

        {visibleInsights.map((i) => (
          <div key={i.id} className="bg-surface rounded-card p-3 flex gap-2.5 items-start">
            <Sparkle />
            <p className="text-sm leading-relaxed flex-1">{i.message}</p>
            <button
              onClick={() => handleDismissInsight(i.id)}
              disabled={dismissing === i.id}
              aria-label="Hinweis ausblenden"
              className="w-6 h-6 rounded-full flex items-center justify-center text-muted shrink-0 disabled:opacity-50"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
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

        {isEmpty && (
          <p className="text-muted text-sm py-8 text-center">
            Frag mich etwas zu deinen Ausgaben, oder ich melde mich hier von selbst, sobald mir etwas auffällt.
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {pendingImage && (
        <div className="px-4 mt-3 flex items-center gap-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingImage.previewUrl} alt="Beleg" className="w-14 h-14 rounded-lg object-cover border border-border" />
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              aria-label="Foto entfernen"
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-bg border border-border flex items-center justify-center"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-muted text-xs">Beleg/Rechnung wird beim Senden ausgelesen</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 px-4 mt-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePickImage}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Foto anhängen"
          className="w-11 h-11 rounded-full bg-surface border border-border flex items-center justify-center shrink-0 transition-transform active:scale-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v13" />
          </svg>
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pendingImage ? "Kommentar zum Foto (optional)..." : "Frag etwas zu deinen Ausgaben..."}
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
