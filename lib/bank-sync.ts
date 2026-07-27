import type { SupabaseClient } from "@supabase/supabase-js";
import { listTransactions, getAccountBalance, type EbTransaction } from "@/lib/enable-banking";
import { categorizeUserTransactions } from "@/lib/categorize";

export type BankConnectionRow = {
  id: string;
  user_id: string;
  session_id: string;
  last_synced_at: string | null;
};

export type BankAccountRow = {
  id: string;
  user_id: string;
  account_uid: string;
};

function externalId(accountUid: string, tx: EbTransaction) {
  if (tx.entry_reference) return `enablebanking:${accountUid}:${tx.entry_reference}`;
  const fingerprint = `${tx.booking_date}-${tx.transaction_amount.amount}-${(tx.remittance_information ?? []).join(" ")}`;
  return `enablebanking:${accountUid}:${Buffer.from(fingerprint).toString("base64").slice(0, 40)}`;
}

// Wir importieren nur ausgehende Buchungen (DBIT) – die App trackt Ausgaben/Abos,
// keine Kontostände oder Einnahmen.
export async function syncBankAccount(
  serviceClient: SupabaseClient,
  account: BankAccountRow,
  opts: { dateFrom?: string; strategy?: string },
) {
  let continuationKey: string | undefined;
  const rows = [];

  do {
    const page = await listTransactions(account.account_uid, {
      dateFrom: opts.dateFrom,
      strategy: opts.strategy,
      continuationKey,
    });

    for (const tx of page.transactions ?? []) {
      if (tx.credit_debit_indicator !== "DBIT") continue;
      const amount = Math.abs(parseFloat(tx.transaction_amount.amount));
      if (!amount) continue;
      rows.push({
        user_id: account.user_id,
        vendor: tx.creditor?.name || (tx.remittance_information ?? []).join(" ").slice(0, 120) || "Unbekannt",
        category: null,
        amount,
        currency: tx.transaction_amount.currency || "EUR",
        charged_at: new Date(tx.booking_date || tx.value_date || Date.now()).toISOString(),
        source: "bank" as const,
        status: "completed" as const,
        external_id: externalId(account.account_uid, tx),
      });
    }

    continuationKey = page.continuation_key;
  } while (continuationKey);

  if (rows.length > 0) {
    const { error } = await serviceClient
      .from("transactions")
      .upsert(rows, { onConflict: "user_id,external_id", ignoreDuplicates: true });
    if (error) {
      console.error("[bank-sync] Upsert fehlgeschlagen:", error.message);
      throw new Error(`transactions upsert fehlgeschlagen: ${error.message}`);
    }
  }

  // Echten Kontostand mitziehen, damit "Verfügbar" im Dashboard den
  // tatsächlichen Saldo zeigt statt einer Einnahmen-minus-Fixkosten-Schätzung.
  try {
    const balance = await getAccountBalance(account.account_uid);
    if (balance !== null) {
      await serviceClient
        .from("bank_accounts")
        .update({ balance, balance_updated_at: new Date().toISOString() })
        .eq("id", account.id);
    }
  } catch (err) {
    console.error("[bank-sync] Kontostand-Abruf fehlgeschlagen:", err instanceof Error ? err.message : err);
  }

  return { imported: rows.length };
}

export async function syncBankConnection(
  serviceClient: SupabaseClient,
  connection: BankConnectionRow,
) {
  const { data: accounts } = await serviceClient
    .from("bank_accounts")
    .select("id, user_id, account_uid")
    .eq("connection_id", connection.id);

  const isFirstSync = !connection.last_synced_at;
  let imported = 0;

  for (const account of (accounts ?? []) as BankAccountRow[]) {
    const result = await syncBankAccount(serviceClient, account, {
      strategy: isFirstSync ? "longest" : undefined,
      dateFrom: isFirstSync ? undefined : connection.last_synced_at ?? undefined,
    });
    imported += result.imported;
  }

  await serviceClient
    .from("bank_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", connection.id);

  // Läuft immer (auch ohne neue Buchungen) - verarbeitet nur Zeilen ohne
  // Kategorie, ist also billig, wenn schon alles kategorisiert ist. Deckt
  // damit auch nachträgliche Backfills für älteren Bestand mit ab.
  try {
    await categorizeUserTransactions(serviceClient, connection.user_id);
  } catch (err) {
    console.error("[bank-sync] Kategorisierung fehlgeschlagen:", err instanceof Error ? err.message : err);
  }

  return { imported, accounts: accounts?.length ?? 0 };
}
