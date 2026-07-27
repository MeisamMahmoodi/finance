import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncBankConnection, type BankConnectionRow } from "@/lib/bank-sync";

export const maxDuration = 60;

// Täglicher Vercel-Cron-Job (siehe vercel.json). Kein Psu-* Header gesetzt,
// das zählt bei den Banken als "Background"-Abruf (i.d.R. bis zu 4x/Tag erlaubt).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  const { data: connections, error } = await serviceClient
    .from("bank_connections")
    .select("id, user_id, session_id, last_synced_at")
    .eq("status", "connected");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const connection of (connections ?? []) as BankConnectionRow[]) {
    try {
      const result = await syncBankConnection(serviceClient, connection);
      results.push({ user_id: connection.user_id, ...result });
    } catch (err) {
      await serviceClient
        .from("bank_connections")
        .update({ status: "error" })
        .eq("id", connection.id);
      results.push({
        user_id: connection.user_id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, synced: results.length, results });
}
