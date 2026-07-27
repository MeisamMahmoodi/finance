import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncGmailForConnection, type GmailConnectionRow } from "@/lib/gmail-sync";

// Manueller Sync-Trigger für den eingeloggten Nutzer (z.B. Button in den Einstellungen).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("list_gmail_connections_for_sync", {
    p_key: process.env.TOKEN_ENCRYPTION_KEY,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const connection = (data as GmailConnectionRow[] | null)?.find(
    (c) => c.user_id === user.id,
  );

  if (!connection) {
    return NextResponse.json({ error: "Kein Gmail verbunden" }, { status: 400 });
  }

  try {
    const result = await syncGmailForConnection(serviceClient, connection);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    await serviceClient.rpc("update_gmail_connection_after_sync", {
      p_user_id: user.id,
      p_access_token: null,
      p_expires_at: null,
      p_status: "error",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync fehlgeschlagen" },
      { status: 500 },
    );
  }
}
