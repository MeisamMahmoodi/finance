"use client";

import { useMemo, useState } from "react";
import { DebtCard } from "@/components/debt-card";
import { AddDebtForm } from "@/components/add-debt-form";
import { AddInvoiceForm } from "@/components/add-invoice-form";
import type { Debt } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

type Period = "monthly" | "3-month" | "yearly";

const PERIOD_LABELS: Record<Period, string> = {
  monthly: "Monthly",
  "3-month": "3-Month",
  yearly: "Yearly",
};

const PERIOD_DAYS: Record<Period, number> = {
  monthly: 31,
  "3-month": 93,
  yearly: 366,
};

export function DebtsShell({ debts, onChanged }: { debts: Debt[]; onChanged: () => void }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const subscriptions = debts.filter((d) => d.kind === "subscription");
  const loans = debts.filter((d) => d.kind === "loan");
  const invoices = debts.filter((d) => d.kind === "invoice");

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) if (inv.tag) set.add(inv.tag);
    return [...set];
  }, [invoices]);

  const visibleInvoices = activeTag ? invoices.filter((inv) => inv.tag === activeTag) : invoices;

  const totalDue = useMemo(() => {
    const horizon = Date.now() + PERIOD_DAYS[period] * 86_400_000;
    return debts
      .filter((d) => !d.next_due_date || new Date(d.next_due_date).getTime() <= horizon)
      .reduce((sum, d) => sum + Math.max((d.kind === "subscription" ? d.monthly_amount ?? d.total_amount : d.total_amount) - d.amount_paid, 0), 0);
  }, [debts, period]);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface rounded-card p-5 flex flex-col items-center">
        <p className="text-secondary text-xs mb-1">This {PERIOD_LABELS[period]} Debts</p>
        <p className="text-[36px] leading-none font-medium tracking-tight mb-3">
          {currencyFormat.format(totalDue)}
        </p>
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-bg border border-border text-xs"
          >
            {PERIOD_LABELS[period]}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d={pickerOpen ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
            </svg>
          </button>
          {pickerOpen && (
            <div className="absolute top-9 left-1/2 -translate-x-1/2 bg-bg border border-border rounded-lg py-1 z-10 min-w-[120px]">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    setPickerOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs ${p === period ? "text-accent" : "text-secondary"}`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {subscriptions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-secondary px-1">Verträge &amp; Abos (KI-erkannt)</p>
          <div className="flex flex-col gap-2">
            {subscriptions.map((d) => (
              <DebtCard key={d.id} debt={d} onChanged={onChanged} />
            ))}
          </div>
        </div>
      )}

      {loans.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-secondary px-1">Kredite &amp; Raten</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {loans.map((d) => (
              <DebtCard key={d.id} debt={d} onChanged={onChanged} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-secondary">Rechnungen</p>
          <button
            onClick={() => setShowInvoiceForm((v) => !v)}
            className="text-xs text-secondary px-2 py-1 rounded-full border border-border transition-transform active:scale-95"
          >
            {showInvoiceForm ? "Abbrechen" : "+ Rechnung"}
          </button>
        </div>

        {tags.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTag(null)}
              className={`shrink-0 px-3 h-7 rounded-full text-xs ${
                activeTag === null ? "bg-accent text-bg" : "bg-surface border border-border text-secondary"
              }`}
            >
              Alle
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`shrink-0 px-3 h-7 rounded-full text-xs ${
                  activeTag === tag ? "bg-accent text-bg" : "bg-surface border border-border text-secondary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {showInvoiceForm && (
          <AddInvoiceForm
            onDone={() => {
              setShowInvoiceForm(false);
              onChanged();
            }}
          />
        )}

        <div className="flex flex-col gap-2">
          {visibleInvoices.map((d) => (
            <DebtCard key={d.id} debt={d} onChanged={onChanged} />
          ))}
        </div>

        {invoices.length === 0 && !showInvoiceForm && (
          <p className="text-muted text-sm py-2 px-1">Noch keine Rechnungen erfasst.</p>
        )}
      </div>

      {debts.length === 0 && !showForm && (
        <p className="text-muted text-sm text-center py-4">
          Noch keine Debts. Verträge/Abos erkennt die KI automatisch beim Synchronisieren, oder leg manuell einen Kredit/eine Rate an.
        </p>
      )}

      {showForm ? (
        <AddDebtForm
          onDone={() => {
            setShowForm(false);
            onChanged();
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="h-11 rounded-lg border border-dashed border-border text-secondary text-sm transition-transform active:scale-[0.98]"
        >
          + Kredit/Rate manuell hinzufügen
        </button>
      )}
    </div>
  );
}
