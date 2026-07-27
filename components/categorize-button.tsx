"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CategorizeButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleClick() {
    setStatus("loading");
    try {
      const res = await fetch("/api/categorize/backfill", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Kategorisierung fehlgeschlagen");
        return;
      }
      setStatus("done");
      setMessage(
        `${data.categorized} Buchung(en) kategorisiert, ${data.recurring} als wiederkehrend erkannt`,
      );
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Kategorisierung fehlgeschlagen");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleClick}
        disabled={status === "loading"}
        className="w-full h-10 rounded-lg bg-surface border border-border text-sm disabled:opacity-60"
      >
        {status === "loading" ? "Kategorisiere..." : "Buchungen kategorisieren"}
      </button>
      {message && (
        <p className={`text-xs px-1 ${status === "error" ? "text-danger" : "text-muted"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
