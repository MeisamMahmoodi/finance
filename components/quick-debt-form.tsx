"use client";

import { useState } from "react";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

// Kompaktes Formular, um eine bereits vorhandene Buchung (z.B. eine
// Klarna-Ratenzahlung, die die KI nicht automatisch erkennt) mit einem Klick
// als Debt zu erfassen - Name und Betrag sind schon bekannt, nur Raten/
// Fälligkeit müssen noch angegeben werden.
export function QuickDebtForm({
  vendor,
  amount,
  onDone,
  onCancel,
}: {
  vendor: string;
  amount: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [installments, setInstallments] = useState("3");
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
          name: vendor,
          total_amount: amount,
          installments_total: Number(installments) || 1,
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
    <form
      onSubmit={handleSubmit}
      className="bg-bg border border-border rounded-lg p-3 flex flex-col gap-2 mt-1 animate-[fadeIn_0.2s_ease]"
    >
      <p className="text-xs text-secondary">
        {vendor} · {currencyFormat.format(amount)} als Ratenzahlung erfassen
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={installments}
          onChange={(e) => setInstallments(e.target.value)}
          placeholder="Anzahl Raten"
          className="flex-1 h-9 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="flex-1 h-9 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent text-secondary"
        />
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 h-9 rounded-lg bg-accent text-bg text-xs font-medium disabled:opacity-60 transition-transform active:scale-[0.98]"
        >
          {loading ? "..." : "Als Debt speichern"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-3 rounded-lg border border-border text-secondary text-xs transition-transform active:scale-[0.98]"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
