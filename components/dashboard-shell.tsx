import { Header } from "@/components/header";
import { Tacho } from "@/components/tacho";
import { Timeline } from "@/components/timeline";
import { AiFeed } from "@/components/ai-feed";
import type { Transaction, AiInsight } from "@/lib/types";

export function DashboardShell({
  transactions,
  insights,
}: {
  transactions: Transaction[];
  insights: AiInsight[];
}) {
  const fixed = transactions
    .filter((t) => t.status === "upcoming")
    .reduce((sum, t) => sum + t.amount, 0);
  const income = 3200; // Platzhalter bis Bank-/Gehaltsdaten angebunden sind (Phase 5)
  const available = income - fixed;

  return (
    <div className="min-h-dvh max-w-5xl mx-auto md:px-6">
      <Header />
      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:mt-4">
        <div className="order-2 md:order-1 px-4 md:px-0">
          <Timeline transactions={transactions} />
        </div>
        <div className="order-1 md:order-2 px-4 md:px-0 md:sticky md:top-6 md:self-start flex flex-col gap-6">
          <Tacho available={available} income={income} fixed={fixed} />
          <AiFeed insights={insights} />
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
