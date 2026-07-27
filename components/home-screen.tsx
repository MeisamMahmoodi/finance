"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Timeline } from "@/components/timeline";
import { AiFeed } from "@/components/ai-feed";
import { StatsCard } from "@/components/stats-card";
import { AccountCard } from "@/components/account-card";
import { BoxesList } from "@/components/boxes-list";
import { AddTransactionForm } from "@/components/add-transaction-form";
import { computeMonthlyFixed, computeCategoryBreakdown, predictNextMonthTotal } from "@/lib/stats";
import type { AppData } from "@/lib/app-data";

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, signDisplay: "always" });

export function HomeScreen({
  data,
  onRefresh,
  onSettingsClick,
}: {
  data: AppData;
  onRefresh: () => void;
  onSettingsClick: () => void;
}) {
  const [tab, setTab] = useState<"accounts" | "boxes">("accounts");
  const [showAddForm, setShowAddForm] = useState(false);
  const { transactions, insights, pendingReviews, chatMessages, monthlyIncome, hasIncomeSet, realBalance, balanceUpdatedAt, balanceChangePercent, accounts, boxes } = data;

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
        <Timeline transactions={transactions} showHeading={false} />
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4">
        <StatsCard categoryTotals={categoryTotals} prediction={prediction} />
        <AiFeed insights={insights} pendingReviews={pendingReviews} initialMessages={chatMessages} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
