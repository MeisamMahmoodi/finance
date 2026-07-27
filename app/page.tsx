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

  return <DashboardShell transactions={transactions} insights={insights} />;
}
