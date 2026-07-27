"use client";

import { useState } from "react";
import { Gauge } from "@/components/gauge";
import type { Debt } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function DebtCard({ debt, onChanged }: { debt: Debt; onChanged: () => void }) {
  const [loading, setLoading] = useState(false);

  async function markPaid() {
    setLoading(true);
    try {
      await fetch(`/api/debts/${debt.id}/pay`, { method: "POST" });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  // Abos/Verträge (von der KI automatisch erkannt) haben keinen sinnvollen
  // Rate-Fortschritt - hier reicht eine schlichte Kosten-Zeile statt Gauge.
  if (debt.kind === "subscription") {
    return (
      <div className="bg-surface rounded-card p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2">
              <path d="M17 2l4 4-4 4" />
              <path d="M3 12v-2a4 4 0 014-4h14" />
              <path d="M7 22l-4-4 4-4" />
              <path d="M21 12v2a4 4 0 01-4 4H3" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium">{debt.name}</p>
            <p className="text-muted text-xs">
              Abo · {debt.next_due_date ? `nächste Abbuchung ${dateFormat.format(new Date(debt.next_due_date))}` : "monatlich"}
            </p>
          </div>
        </div>
        <p className="text-sm font-medium">{currencyFormat.format(debt.monthly_amount ?? debt.total_amount)}</p>
      </div>
    );
  }

  const percent = debt.total_amount > 0 ? (debt.amount_paid / debt.total_amount) * 100 : 0;
  const remaining = Math.max(debt.total_amount - debt.amount_paid, 0);
  const done = debt.installments_paid >= debt.installments_total;

  return (
    <div className="bg-surface rounded-card p-4 flex flex-col items-center gap-3">
      <div className="w-full flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{debt.name}</p>
          <p className="text-muted text-xs">
            {currencyFormat.format(debt.total_amount)}
            {debt.next_due_date && ` · fällig ${dateFormat.format(new Date(debt.next_due_date))}`}
          </p>
        </div>
      </div>

      <div className="relative flex flex-col items-center -mb-2">
        <Gauge percent={percent} size={180} />
        <div className="absolute top-[58px] flex flex-col items-center">
          <span className="text-2xl font-medium">{Math.round(percent)}%</span>
          <span className="text-muted text-xs">
            {debt.installments_paid}/{debt.installments_total} bezahlt
          </span>
        </div>
      </div>

      <div className="w-full flex items-center justify-between text-xs px-1">
        <span className="text-muted">Restbetrag</span>
        <span className="font-medium">{currencyFormat.format(remaining)}</span>
      </div>

      <button
        onClick={markPaid}
        disabled={loading || done}
        className="w-full h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-50 transition-transform active:scale-[0.98]"
      >
        {done ? "Vollständig bezahlt" : loading ? "..." : "Rate als bezahlt markieren"}
      </button>
    </div>
  );
}
