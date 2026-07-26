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

  const transactions: Transaction[] =
    txData && txData.length > 0 ? (txData as Transaction[]) : demoTransactions;
  const insights: AiInsight[] =
    insightData && insightData.length > 0
      ? (insightData as AiInsight[])
      : demoInsights;

  return <DashboardShell transactions={transactions} insights={insights} />;
}
