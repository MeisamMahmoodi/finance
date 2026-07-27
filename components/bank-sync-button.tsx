"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BankSyncButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSync() {
    setStatus("loading");
    try {
      const res = await fetch("/api/sync/bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Sync fehlgeschlagen");
        return;
      }
      setStatus("done");
      setMessage(`${data.imported} neue Buchung(en) aus ${data.accounts} Konto/Konten`);
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("Sync fehlgeschlagen");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={handleSync}
        disabled={status === "loading"}
        className="w-full h-10 rounded-lg bg-surface border border-border text-sm disabled:opacity-60"
      >
        {status === "loading" ? "Synchronisiere..." : "Jetzt synchronisieren"}
      </button>
      {message && (
        <p
          className={`text-xs px-1 ${status === "error" ? "text-danger" : "text-muted"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
