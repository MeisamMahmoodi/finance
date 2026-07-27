import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "@/lib/google-oauth";
import { listCandidateMessageIds, getMessageDetail } from "@/lib/gmail";
import { extractInvoiceFromEmail } from "@/lib/gemini";

export type GmailConnectionRow = {
  user_id: string;
  email_address: string | null;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

const MAX_MESSAGES_PER_RUN = 20;

export async function syncGmailForConnection(
  serviceClient: SupabaseClient,
  connection: GmailConnectionRow,
) {
  let accessToken = connection.access_token;
  const expiresAt = connection.access_token_expires_at
    ? new Date(connection.access_token_expires_at).getTime()
    : 0;
  const needsRefresh = !accessToken || expiresAt < Date.now() + 60_000;

  if (needsRefresh) {
    const refreshed = await refreshAccessToken(connection.refresh_token);
    accessToken = refreshed.access_token;
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await serviceClient.rpc("update_gmail_connection_after_sync", {
      p_user_id: connection.user_id,
      p_access_token: accessToken,
      p_expires_at: newExpiresAt,
      p_status: "connected",
    });
  }

  const ids = await listCandidateMessageIds(accessToken!, MAX_MESSAGES_PER_RUN);
  const rows = [];

  for (const id of ids) {
    const detail = await getMessageDetail(accessToken!, id);
    const extracted = await extractInvoiceFromEmail(detail);
    if (extracted.is_invoice && typeof extracted.amount === "number" && extracted.amount > 0) {
      rows.push({
        user_id: connection.user_id,
        vendor: extracted.vendor || detail.from,
        category: extracted.category ?? null,
        amount: extracted.amount,
        currency: extracted.currency || "EUR",
        charged_at: extracted.charged_at || new Date(detail.date).toISOString(),
        source: "email" as const,
        status: "completed" as const,
        external_id: `gmail:${id}`,
      });
    }
  }

  if (rows.length > 0) {
    await serviceClient
      .from("transactions")
      .upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true });
  }

  if (!needsRefresh) {
    await serviceClient.rpc("update_gmail_connection_after_sync", {
      p_user_id: connection.user_id,
      p_access_token: accessToken,
      p_expires_at: connection.access_token_expires_at,
      p_status: "connected",
    });
  }

  return { scanned: ids.length, imported: rows.length };
}
