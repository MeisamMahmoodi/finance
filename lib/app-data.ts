import type { SupabaseClient, User } from "@supabase/supabase-js";
import { demoTransactions, demoInsights } from "@/lib/demo-data";
import type { Transaction, AiInsight, Box, Debt, PendingReview, ChatMessage } from "@/lib/types";

export type AccountSummary = {
  id: string;
  name: string;
  masked: string;
  balance: number;
};

export type AppData = {
  transactions: Transaction[];
  insights: AiInsight[];
  pendingReviews: PendingReview[];
  chatMessages: ChatMessage[];
  monthlyIncome: number;
  hasIncomeSet: boolean;
  realBalance: number | null;
  balanceUpdatedAt: string | null;
  balanceChangePercent: number | null;
  accounts: AccountSummary[];
  boxes: Box[];
  debts: Debt[];
  userEmail: string;
  gmailConnection: { email_address: string | null; status: string | null; last_synced_at: string | null } | null;
  bankConnection: { aspsp_name: string | null; status: string | null; last_synced_at: string | null } | null;
};

// Ein einziger gebündelter Ladevorgang für die gesamte App (Home + Debts +
// Settings). Damit müssen beim Tab-Wechsel im Client keine neuen
// Server-Requests mehr gefeuert werden - alle Daten sind schon da.
export async function loadAppData(supabase: SupabaseClient, user: User): Promise<AppData> {
  const [
    { data: txData },
    { data: insightData },
    { data: reviewData },
    { data: chatData },
    { data: gmailConn },
    { data: bankConn },
    { data: settings },
    { data: accounts },
    { data: boxesData },
    { data: debtsData },
  ] = await Promise.all([
    supabase.from("transactions").select("*").order("charged_at", { ascending: true }),
    supabase.from("ai_insights").select("*").eq("dismissed", false).order("created_at", { ascending: false }),
    supabase
      .from("pending_reviews")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(30),
    supabase
      .from("email_connections")
      .select("email_address, status, last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("bank_connections")
      .select("aspsp_name, status, last_synced_at")
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
    supabase.from("debts").select("*").order("next_due_date", { ascending: true, nullsFirst: false }),
  ]);

  const hasRealConnection = Boolean(gmailConn || bankConn);

  const transactions: Transaction[] =
    txData && txData.length > 0 ? (txData as Transaction[]) : hasRealConnection ? [] : demoTransactions;
  const insights: AiInsight[] =
    insightData && insightData.length > 0 ? (insightData as AiInsight[]) : hasRealConnection ? [] : demoInsights;

  const monthlyIncome = hasRealConnection ? (settings?.monthly_income ?? 0) : 3200;

  const realBalance = accounts && accounts.length > 0 ? accounts.reduce((sum, a) => sum + Number(a.balance), 0) : null;
  const balanceUpdatedAt =
    accounts && accounts.length > 0
      ? accounts
          .map((a) => a.balance_updated_at)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null
      : null;

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

  return {
    transactions,
    insights,
    pendingReviews: (reviewData ?? []) as PendingReview[],
    chatMessages: (chatData ?? []) as ChatMessage[],
    monthlyIncome,
    hasIncomeSet: Boolean(settings),
    realBalance,
    balanceUpdatedAt,
    balanceChangePercent,
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      name: a.name || bankConn?.aspsp_name || "Bankkonto",
      masked: a.iban ? `****${a.iban.slice(-4)}` : "****",
      balance: Number(a.balance ?? 0),
    })),
    boxes: (boxesData ?? []) as Box[],
    debts: (debtsData ?? []) as Debt[],
    userEmail: user.email ?? "",
    gmailConnection: gmailConn ?? null,
    bankConnection: bankConn ?? null,
  };
}
