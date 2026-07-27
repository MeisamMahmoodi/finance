"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "@/components/gauge";
import type { Debt } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function DebtCard({ debt }: { debt: Debt }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const percent = debt.total_amount > 0 ? (debt.amount_paid / debt.total_amount) * 100 : 0;
  const remaining = Math.max(debt.total_amount - debt.amount_paid, 0);

  async function markPaid() {
    setLoading(true);
    try {
      await fetch(`/api/debts/${debt.id}/pay`, { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

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
        className="w-full h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-50"
      >
        {done ? "Vollständig bezahlt" : loading ? "..." : "Rate als bezahlt markieren"}
      </button>
    </div>
  );
}
