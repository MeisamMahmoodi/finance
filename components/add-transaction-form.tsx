"use client";

import { useState } from "react";
import { SPENDING_CATEGORIES } from "@/lib/categorize";

export function AddTransactionForm({ onDone }: { onDone: () => void }) {
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          amount: Number(amount),
          direction,
          category: category || null,
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
      <div className="flex bg-bg rounded-full p-1">
        <button
          type="button"
          onClick={() => setDirection("out")}
          className={`flex-1 h-8 rounded-full text-xs font-medium transition-colors ${
            direction === "out" ? "bg-accent text-bg" : "text-secondary"
          }`}
        >
          Ausgabe
        </button>
        <button
          type="button"
          onClick={() => setDirection("in")}
          className={`flex-1 h-8 rounded-full text-xs font-medium transition-colors ${
            direction === "in" ? "bg-accent text-bg" : "text-secondary"
          }`}
        >
          Einnahme
        </button>
      </div>
      <input
        value={vendor}
        onChange={(e) => setVendor(e.target.value)}
        placeholder="Beschreibung (z.B. Bargeld Abendessen)"
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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent text-secondary"
        >
          <option value="">Kategorie (auto)</option>
          {SPENDING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60 transition-transform active:scale-[0.98]"
      >
        {loading ? "..." : "Hinzufügen"}
      </button>
    </form>
  );
}
