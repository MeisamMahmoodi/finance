import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncBankConnection, type BankConnectionRow } from "@/lib/bank-sync";

// Manueller Sync-Trigger für den eingeloggten Nutzer (Button in den Einstellungen).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { data: connection, error } = await supabase
    .from("bank_connections")
    .select("id, user_id, session_id, last_synced_at")
    .eq("user_id", user.id)
    .eq("status", "connected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!connection) {
    return NextResponse.json({ error: "Keine Bank verbunden" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  try {
    const result = await syncBankConnection(serviceClient, connection as BankConnectionRow);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await serviceClient
      .from("bank_connections")
      .update({ status: "error" })
      .eq("id", connection.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync fehlgeschlagen" },
      { status: 500 },
    );
  }
}
