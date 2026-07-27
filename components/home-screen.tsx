"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Timeline } from "@/components/timeline";
import { StatsCard } from "@/components/stats-card";
import { AccountCard } from "@/components/account-card";
import { BoxesList } from "@/components/boxes-list";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { computeMonthlyFixed, computeCategoryBreakdown, predictNextMonthTotal } from "@/lib/stats";
import type { AppData } from "@/lib/app-data";

// Jeder Cent zählt - immer mit 2 Nachkommastellen, nicht gerundet auf ganze
// Euro (vorher zeigte "-2,83€" fälschlich als "-3€" an).
const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, signDisplay: "always" });

export function HomeScreen({
  data,
  onRefresh,
  onSettingsClick,
  onOpenChat,
}: {
  data: AppData;
  onRefresh: () => void;
  onSettingsClick: () => void;
  onOpenChat: () => void;
}) {
  const [tab, setTab] = useState<"accounts" | "boxes">("accounts");
  const [showAddForm, setShowAddForm] = useState(false);
  const { transactions, pendingReviews, monthlyIncome, hasIncomeSet, realBalance, balanceUpdatedAt, balanceChangePercent, accounts, boxes } = data;

  const fixed = computeMonthlyFixed(transactions);
  const available = realBalance !== null ? realBalance : monthlyIncome - fixed;
  const categoryTotals = computeCategoryBreakdown(transactions);
  const prediction = predictNextMonthTotal(transactions);

  return (
    <div className="pb-28">
      <Header onSettingsClick={onSettingsClick} />

      <div className="flex flex-col items-center py-6 px-4">
        <p className="text-secondary text-xs mb-1">{realBalance !== null ? "Total Balance" : "Verfügbar"}</p>
        <p className="text-[40px] leading-none font-medium tracking-tight text-ink">
          {currencyFormat.format(available)}
        </p>
        {balanceChangePercent !== null && (
          <span
            className={`mt-3 text-xs px-2.5 py-1 rounded-full ${
              balanceChangePercent >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {percentFormat.format(balanceChangePercent / 100)}
          </span>
        )}
        {realBalance !== null && balanceUpdatedAt && (
          <p className="text-muted text-xs mt-2">Stand {new Date(balanceUpdatedAt).toLocaleString("de-DE")}</p>
        )}
        {!hasIncomeSet && (
          <p className="text-muted text-xs mt-1 text-center">
            Einnahmen noch nicht hinterlegt — in den Einstellungen eintragen.
          </p>
        )}
      </div>

      <div className="px-4">
        <div className="flex bg-surface rounded-full p-1 mb-3">
          <button
            onClick={() => setTab("accounts")}
            className={`flex-1 h-8 rounded-full text-xs font-medium transition-colors ${
              tab === "accounts" ? "bg-accent text-bg" : "text-secondary"
            }`}
          >
            Accounts
          </button>
          <button
            onClick={() => setTab("boxes")}
            className={`flex-1 h-8 rounded-full text-xs font-medium transition-colors ${
              tab === "boxes" ? "bg-accent text-bg" : "text-secondary"
            }`}
          >
            Boxes
          </button>
        </div>

        {tab === "accounts" ? (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {accounts.map((a) => (
              <AccountCard key={a.id} label={a.name} masked={a.masked} balance={a.balance} tone="accent" />
            ))}
            <AccountCard label="Einkommen" masked="Ø/Monat" balance={monthlyIncome} tone="success" />
            {accounts.length === 0 && <p className="text-muted text-xs py-2 px-1">Noch kein Bankkonto verbunden.</p>}
          </div>
        ) : (
          <BoxesList boxes={boxes} onChanged={onRefresh} />
        )}
      </div>

      <div className="px-4 mt-6 flex items-center justify-between">
        <p className="text-xs text-secondary px-1">Transactions</p>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="text-xs text-secondary px-2 py-1 rounded-full border border-border transition-transform active:scale-95"
        >
          {showAddForm ? "Abbrechen" : "+ Manuell"}
        </button>
      </div>
      {showAddForm && (
        <div className="px-4 mt-2">
          <AddTransactionForm
            onDone={() => {
              setShowAddForm(false);
              onRefresh();
            }}
          />
        </div>
      )}
      <div className="px-4 mt-2">
        <Timeline transactions={transactions} showHeading={false} onChanged={onRefresh} />
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4">
        <StatsCard categoryTotals={categoryTotals} prediction={prediction} />

        <button
          onClick={onOpenChat}
          className="bg-surface rounded-card p-4 flex items-center gap-3 text-left transition-transform active:scale-[0.98]"
        >
          <div className="w-9 h-9 rounded-full bg-bg border border-border flex items-center justify-center shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="1.8">
              <path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">AI-Assistent</p>
            <p className="text-muted text-xs">
              {pendingReviews.length > 0
                ? `${pendingReviews.length} Rückfrage${pendingReviews.length > 1 ? "n" : ""} wartet auf dich`
                : "Frag etwas zu deinen Ausgaben"}
            </p>
          </div>
          {pendingReviews.length > 0 && (
            <span className="w-6 h-6 rounded-full bg-accent text-bg text-xs font-medium flex items-center justify-center shrink-0">
              {pendingReviews.length}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9a9a9d" strokeWidth="2" className="shrink-0">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
