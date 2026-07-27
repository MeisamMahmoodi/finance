"use client";

import { useState } from "react";

// Rechnungen sind bewusst freier als Kredite/Abos: der Nutzer vergibt einen
// eigenen Tag/Kategorie-Namen (z.B. "Auto", "Zahnarzt", "Handwerker") statt
// einer festen Kategorie-Liste, damit er sie individuell einsortieren kann.
export function AddInvoiceForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [tag, setTag] = useState("");
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
          total_amount: Number(amount),
          kind: "invoice",
          tag: tag || null,
          next_due_date: dueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Fehler beim Speichern");
        return;
      }
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
        placeholder="Rechnung (z.B. Zahnarzt, Werkstatt)"
        required
        className="h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
      />
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Betrag"
          required
          className="flex-1 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Kategorie (frei, z.B. Auto)"
          className="flex-1 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
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
        className="h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60 transition-transform active:scale-[0.98]"
      >
        {loading ? "..." : "Rechnung hinzufügen"}
      </button>
    </form>
  );
}
