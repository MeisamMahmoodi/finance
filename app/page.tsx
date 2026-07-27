import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { demoTransactions, demoInsights } from "@/lib/demo-data";
import type { Transaction, AiInsight } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: txData } = await supabase
    .from("transactions")
    .select("*")
    .order("charged_at", { ascending: true });

  const { data: insightData } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("dismissed", false)
    .order("created_at", { ascending: false });

  // Demo-Daten nur zeigen, solange der Nutzer noch gar keine echte Quelle
  // verbunden hat. Sobald Gmail oder Bank verbunden sind, soll die Startseite
  // den echten (ggf. leeren) Stand zeigen statt Fake-Daten vorzugaukeln.
  const { data: gmailConn } = await supabase
    .from("email_connections")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "connected")
    .maybeSingle();
  const { data: bankConn } = await supabase
    .from("bank_connections")
    .select("status")
    .eq("user_id", user.id)
    .eq("status", "connected")
    .maybeSingle();
  const hasRealConnection = Boolean(gmailConn || bankConn);

  const transactions: Transaction[] =
    txData && txData.length > 0
      ? (txData as Transaction[])
      : hasRealConnection
        ? []
        : demoTransactions;
  const insights: AiInsight[] =
    insightData && insightData.length > 0
      ? (insightData as AiInsight[])
      : hasRealConnection
        ? []
        : demoInsights;

  const { data: settings } = await supabase
    .from("user_settings")
    .select("monthly_income")
    .eq("user_id", user.id)
    .maybeSingle();

  // Ohne echte Verbindung bleiben wir bei der Demo-Zahl (3200), damit die
  // Startseite vor dem ersten Connect nicht leer/kaputt wirkt.
  const monthlyIncome = hasRealConnection ? (settings?.monthly_income ?? 0) : 3200;

  // Echter Kontostand (Summe aller verbundenen Konten) statt Einnahmen-
  // minus-Fixkosten-Schätzung, sobald die Bank mindestens einmal
  // synchronisiert wurde.
  const { data: accountBalances } = await supabase
    .from("bank_accounts")
    .select("balance, balance_updated_at")
    .eq("user_id", user.id)
    .not("balance", "is", null);

  const realBalance =
    accountBalances && accountBalances.length > 0
      ? accountBalances.reduce((sum, a) => sum + Number(a.balance), 0)
      : null;
  const balanceUpdatedAt =
    accountBalances && accountBalances.length > 0
      ? accountBalances
          .map((a) => a.balance_updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null
      : null;

  return (
    <DashboardShell
      transactions={transactions}
      insights={insights}
      monthlyIncome={monthlyIncome}
      hasIncomeSet={Boolean(settings)}
      realBalance={realBalance}
      balanceUpdatedAt={balanceUpdatedAt}
    />
  );
}
