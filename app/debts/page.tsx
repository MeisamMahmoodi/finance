import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DebtsShell } from "@/components/debts-shell";
import { BottomNav } from "@/components/bottom-nav";
import type { Debt } from "@/lib/types";

export default async function DebtsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: debts } = await supabase
    .from("debts")
    .select("*")
    .order("next_due_date", { ascending: true, nullsFirst: false });

  return (
    <div className="min-h-dvh max-w-5xl mx-auto px-4 py-6 pb-28">
      <h1 className="text-sm font-medium mb-6">Debts</h1>
      <DebtsShell debts={(debts ?? []) as Debt[]} />
      <BottomNav />
    </div>
  );
}
