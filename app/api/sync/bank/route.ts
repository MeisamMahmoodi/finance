import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncBankConnection, type BankConnectionRow } from "@/lib/bank-sync";

export const maxDuration = 60;

// Manueller Sync-Trigger. Mit connectionId im Body wird nur diese eine
// Bank-Verbindung synchronisiert (Button neben der jeweiligen Bank in den
// Einstellungen); ohne connectionId werden alle verbundenen Banken des
// Nutzers synchronisiert (globaler Sync-Button in der BottomNav).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const connectionId = typeof body?.connectionId === "string" ? body.connectionId : null;

  let query = supabase
    .from("bank_connections")
    .select("id, user_id, session_id, last_synced_at")
    .eq("user_id", user.id)
    .eq("status", "connected");

  if (connectionId) {
    query = query.eq("id", connectionId);
  }

  const { data: connections, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!connections || connections.length === 0) {
    return NextResponse.json({ error: "Keine Bank verbunden" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  let imported = 0;
  let accounts = 0;
  const errors: string[] = [];

  for (const connection of connections as BankConnectionRow[]) {
    try {
      const result = await syncBankConnection(serviceClient, connection);
      imported += result.imported;
      accounts += result.accounts;
    } catch (err) {
      await serviceClient.from("bank_connections").update({ status: "error" }).eq("id", connection.id);
      errors.push(err instanceof Error ? err.message : "Sync fehlgeschlagen");
    }
  }

  if (errors.length > 0 && imported === 0 && accounts === 0) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, imported, accounts, errors: errors.length > 0 ? errors : undefined });
}
