"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Timeline } from "@/components/timeline";
import { AiFeed } from "@/components/ai-feed";
import { StatsCard } from "@/components/stats-card";
import { AccountCard } from "@/components/account-card";
import { BoxesList } from "@/components/boxes-list";
import { BottomNav } from "@/components/bottom-nav";
import { computeMonthlyFixed, computeCategoryBreakdown, predictNextMonthTotal } from "@/lib/stats";
import type { Transaction, AiInsight, Box } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const percentFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, signDisplay: "always" });

type AccountSummary = {
  id: string;
  name: string;
  masked: string;
  balance: number;
};

export function DashboardShell({
  transactions,
  insights,
  monthlyIncome,
  hasIncomeSet,
  realBalance,
  balanceUpdatedAt,
  balanceChangePercent,
  accounts,
  boxes,
}: {
  transactions: Transaction[];
  insights: AiInsight[];
  monthlyIncome: number;
  hasIncomeSet: boolean;
  realBalance: number | null;
  balanceUpdatedAt: string | null;
  balanceChangePercent: number | null;
  accounts: AccountSummary[];
  boxes: Box[];
}) {
  const [tab, setTab] = useState<"accounts" | "boxes">("accounts");
  const fixed = computeMonthlyFixed(transactions);
  const available = realBalance !== null ? realBalance : monthlyIncome - fixed;
  const categoryTotals = computeCategoryBreakdown(transactions);
  const prediction = predictNextMonthTotal(transactions);

  return (
    <div className="min-h-dvh max-w-5xl mx-auto md:px-6 pb-28">
      <Header />
      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:mt-4">
        <div className="order-2 md:order-1 px-4 md:px-0">
          <Timeline transactions={transactions} />
        </div>
        <div className="order-1 md:order-2 px-4 md:px-0 md:sticky md:top-6 md:self-start flex flex-col gap-6">
          <div className="flex flex-col items-center py-6">
            <p className="text-secondary text-xs mb-1">{realBalance !== null ? "Total Balance" : "Verfügbar"}</p>
            <p className="text-[40px] leading-none font-medium tracking-tight">
              {currencyFormat.format(available)}
            </p>
            {balanceChangePercent !== null && (
              <span
                className={`mt-3 text-xs px-2.5 py-1 rounded-full ${
                  balanceChangePercent >= 0 ? "bg-success/20 text-success" : "bg-danger/20 text-danger"
                }`}
              >
                {percentFormat.format(balanceChangePercent / 100)}
              </span>
            )}
            {realBalance !== null && balanceUpdatedAt && (
              <p className="text-muted text-xs mt-2">
                Stand {new Date(balanceUpdatedAt).toLocaleString("de-DE")}
              </p>
            )}
            {!hasIncomeSet && (
              <p className="text-muted text-xs mt-1 text-center">
                Einnahmen noch nicht hinterlegt — in den Einstellungen eintragen.
              </p>
            )}
          </div>

          <div>
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
              <div className="flex gap-2 overflow-x-auto pb-1">
                {accounts.map((a) => (
                  <AccountCard key={a.id} label={a.name} masked={a.masked} balance={a.balance} tone="accent" />
                ))}
                <AccountCard label="Einkommen" masked="Ø/Monat" balance={monthlyIncome} tone="success" />
                {accounts.length === 0 && (
                  <p className="text-muted text-xs py-2 px-1">Noch kein Bankkonto verbunden.</p>
                )}
              </div>
            ) : (
              <BoxesList boxes={boxes} />
            )}
          </div>

          <StatsCard categoryTotals={categoryTotals} prediction={prediction} />
          <AiFeed insights={insights} />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
