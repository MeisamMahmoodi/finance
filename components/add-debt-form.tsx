"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddDebtForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [installments, setInstallments] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          total_amount: Number(total),
          installments_total: Number(installments),
          next_due_date: dueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fehler beim Speichern");
        return;
      }
      router.refresh();
      onDone();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-card p-4 flex flex-col gap-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (z.B. Home rent)"
        required
        className="h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="Gesamtbetrag"
          required
          className="flex-1 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
        />
        <input
          type="number"
          inputMode="numeric"
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
          placeholder="Raten"
          min={1}
          className="w-24 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
        />
      </div>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent text-secondary"
      />
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60"
      >
        {loading ? "..." : "Debt anlegen"}
      </button>
    </form>
  );
}
