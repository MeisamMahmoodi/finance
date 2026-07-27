import { Header } from "@/components/header";
import { Tacho } from "@/components/tacho";
import { Timeline } from "@/components/timeline";
import { AiFeed } from "@/components/ai-feed";
import { StatsCard } from "@/components/stats-card";
import { computeMonthlyFixed, computeCategoryBreakdown, predictNextMonthTotal } from "@/lib/stats";
import type { Transaction, AiInsight } from "@/lib/types";

export function DashboardShell({
  transactions,
  insights,
  monthlyIncome,
  hasIncomeSet,
}: {
  transactions: Transaction[];
  insights: AiInsight[];
  monthlyIncome: number;
  hasIncomeSet: boolean;
}) {
  const fixed = computeMonthlyFixed(transactions);
  const income = monthlyIncome;
  const available = income - fixed;
  const categoryTotals = computeCategoryBreakdown(transactions);
  const prediction = predictNextMonthTotal(transactions);

  return (
    <div className="min-h-dvh max-w-5xl mx-auto md:px-6">
      <Header />
      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:mt-4">
        <div className="order-2 md:order-1 px-4 md:px-0">
          <Timeline transactions={transactions} />
        </div>
        <div className="order-1 md:order-2 px-4 md:px-0 md:sticky md:top-6 md:self-start flex flex-col gap-6">
          <Tacho available={available} income={income} fixed={fixed} />
          {!hasIncomeSet && (
            <p className="text-muted text-xs -mt-4 px-1">
              Einnahmen noch nicht hinterlegt — in den Einstellungen eintragen.
            </p>
          )}
          <StatsCard categoryTotals={categoryTotals} prediction={prediction} />
          <AiFeed insights={insights} />
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
