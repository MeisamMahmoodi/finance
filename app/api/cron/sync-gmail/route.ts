import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncGmailForConnection, type GmailConnectionRow } from "@/lib/gmail-sync";

export const maxDuration = 60;

// Täglicher Vercel-Cron-Job (siehe vercel.json). Vercel sendet bei Cron-Aufrufen
// automatisch "Authorization: Bearer <CRON_SECRET>", wenn CRON_SECRET gesetzt ist.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient.rpc("list_gmail_connections_for_sync", {
    p_key: process.env.TOKEN_ENCRYPTION_KEY,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const connections = (data as GmailConnectionRow[] | null) ?? [];
  const results = [];

  for (const connection of connections) {
    try {
      const result = await syncGmailForConnection(serviceClient, connection);
      results.push({ user_id: connection.user_id, ...result });
    } catch (err) {
      await serviceClient.rpc("update_gmail_connection_after_sync", {
        p_user_id: connection.user_id,
        p_access_token: null,
        p_expires_at: null,
        p_status: "error",
      });
      results.push({
        user_id: connection.user_id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
