import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";
import { demoTransactions, demoInsights } from "@/lib/demo-data";
import type { Transaction, AiInsight, Box } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Alle unabhängigen Queries parallel abschicken statt nacheinander -
  // spart mehrere Round-Trips und war der Hauptgrund für die langsamen
  // Seitenladezeiten.
  const [
    { data: txData },
    { data: insightData },
    { data: gmailConn },
    { data: bankConn },
    { data: settings },
    { data: accounts },
    { data: boxesData },
  ] = await Promise.all([
    supabase.from("transactions").select("*").order("charged_at", { ascending: true }),
    supabase
      .from("ai_insights")
      .select("*")
      .eq("dismissed", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("email_connections")
      .select("status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .maybeSingle(),
    supabase
      .from("bank_connections")
      .select("status, aspsp_name")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_settings").select("monthly_income").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("bank_accounts")
      .select("id, name, iban, balance, balance_updated_at")
      .eq("user_id", user.id)
      .not("balance", "is", null),
    supabase.from("boxes").select("*").order("created_at", { ascending: true }),
  ]);

  // Demo-Daten nur zeigen, solange der Nutzer noch gar keine echte Quelle
  // verbunden hat. Sobald Gmail oder Bank verbunden sind, soll die Startseite
  // den echten (ggf. leeren) Stand zeigen statt Fake-Daten vorzugaukeln.
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

  // Ohne echte Verbindung bleiben wir bei der Demo-Zahl (3200), damit die
  // Startseite vor dem ersten Connect nicht leer/kaputt wirkt.
  const monthlyIncome = hasRealConnection ? (settings?.monthly_income ?? 0) : 3200;

  const realBalance =
    accounts && accounts.length > 0
      ? accounts.reduce((sum, a) => sum + Number(a.balance), 0)
      : null;
  const balanceUpdatedAt =
    accounts && accounts.length > 0
      ? accounts
          .map((a) => a.balance_updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null
      : null;

  // Trend: ältester bekannter Saldo der letzten 30 Tage vs. jetzt. Braucht
  // die Account-IDs aus der vorigen Abfrage, kann also nicht Teil des
  // ersten Promise.all sein.
  let balanceChangePercent: number | null = null;
  if (accounts && accounts.length > 0) {
    const accountIds = accounts.map((a) => a.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: history } = await supabase
      .from("bank_balance_history")
      .select("balance, recorded_at")
      .in("account_id", accountIds)
      .gte("recorded_at", thirtyDaysAgo)
      .order("recorded_at", { ascending: true })
      .limit(1);
    const oldest = history?.[0];
    if (oldest && realBalance !== null && Number(oldest.balance) !== 0) {
      balanceChangePercent = ((realBalance - Number(oldest.balance)) / Math.abs(Number(oldest.balance))) * 100;
    }
  }

  return (
    <DashboardShell
      transactions={transactions}
      insights={insights}
      monthlyIncome={monthlyIncome}
      hasIncomeSet={Boolean(settings)}
      realBalance={realBalance}
      balanceUpdatedAt={balanceUpdatedAt}
      balanceChangePercent={balanceChangePercent}
      accounts={(accounts ?? []).map((a) => ({
        id: a.id,
        name: a.name || bankConn?.aspsp_name || "Bankkonto",
        masked: a.iban ? `****${a.iban.slice(-4)}` : "****",
        balance: Number(a.balance ?? 0),
      }))}
      boxes={(boxesData ?? []) as Box[]}
    />
  );
}
