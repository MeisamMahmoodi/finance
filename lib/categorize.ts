import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Kategorien: "Wiederkehrend" ist speziell — das erkennen wir deterministisch
// (gleicher Empfänger + ähnlicher Betrag + ~monatlicher Abstand), nicht per KI.
// Alle anderen Kategorien ordnet Gemini den restlichen Buchungen zu.
export const SPENDING_CATEGORIES = [
  "Essen",
  "Transport",
  "Arbeit",
  "Spaß",
  "Wohnen",
  "Shopping",
  "Gesundheit",
  "Sonstiges",
] as const;

export const RECURRING_CATEGORY = "Wiederkehrend";

type TxRow = {
  id: string;
  vendor: string;
  amount: number;
  charged_at: string;
  category: string | null;
};

function normalizeVendor(vendor: string) {
  return vendor
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^a-zäöüß\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Erkennt wiederkehrende Zahlungen: gleicher (normalisierter) Empfänger,
// Beträge innerhalb 20% Toleranz, Abstand zwischen aufeinanderfolgenden
// Buchungen 20-40 Tage (grob monatlich). Ab 2 Treffern gilt die ganze
// Gruppe als "Wiederkehrend".
export function detectRecurringIds(transactions: TxRow[]): Set<string> {
  const groups = new Map<string, TxRow[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const recurringIds = new Set<string>();
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.charged_at).getTime() - new Date(b.charged_at).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const daysApart =
        (new Date(cur.charged_at).getTime() - new Date(prev.charged_at).getTime()) / 86_400_000;
      const amountDiff = Math.abs(cur.amount - prev.amount) / Math.max(prev.amount, 1);
      if (daysApart >= 20 && daysApart <= 40 && amountDiff <= 0.2) {
        recurringIds.add(prev.id);
        recurringIds.add(cur.id);
      }
    }
  }
  return recurringIds;
}

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return client;
}

function addDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Legt für eine erkannte wiederkehrende Zahlung (deterministisch oder per KI
// bestätigt) einen "Debt"-Eintrag vom Typ Subscription an bzw. aktualisiert
// ihn, damit die Debts-Seite automatisch alle Verträge/Abos auflistet - ohne
// dass der Nutzer sie manuell eintragen muss.
async function upsertSubscriptionDebt(
  serviceClient: SupabaseClient,
  userId: string,
  vendorKey: string,
  vendorLabel: string,
  amount: number,
  lastChargedAt: string,
  sourceTransactionId: string,
) {
  const { data: existing } = await serviceClient
    .from("debts")
    .select("id")
    .eq("user_id", userId)
    .eq("vendor_key", vendorKey)
    .eq("kind", "subscription")
    .maybeSingle();

  const nextDue = addDays(lastChargedAt, 30);
  const payload = {
    name: vendorLabel,
    total_amount: amount,
    monthly_amount: amount,
    next_due_date: nextDue,
    source_transaction_id: sourceTransactionId,
  };

  if (existing) {
    await serviceClient.from("debts").update(payload).eq("id", existing.id);
  } else {
    await serviceClient.from("debts").insert({
      user_id: userId,
      vendor_key: vendorKey,
      kind: "subscription",
      amount_paid: 0,
      installments_total: 1,
      installments_paid: 0,
      ...payload,
    });
  }
}

// KI-Einschätzung, ob eine einzelne (noch nicht wiederholte) Buchung ein
// Abo/Vertrag sein könnte - z.B. eine brandneue Netflix-Buchung, die die
// deterministische Erkennung (braucht 2+ Vorkommen) noch nicht fassen kann.
async function detectContractCandidates(
  rows: { id: string; vendor: string; amount: number }[],
): Promise<Record<string, "yes" | "no" | "unsure">> {
  if (rows.length === 0) return {};
  const model = getClient().getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });

  const list = rows.map((r) => `${r.id}|${r.vendor}|${r.amount.toFixed(2)}€`).join("\n");
  const prompt = `Für jede Buchung (Format "id|Empfänger|Betrag") schätze ein, ob es sich um ein Abo oder einen Vertrag handelt (wiederkehrende Zahlung wie Miete, Streaming, Versicherung, Fitnessstudio, Software-Abo, Kredit-/Ratenzahlung, Handyvertrag) oder um eine einmalige Ausgabe.
Antworte "yes" wenn du dir sehr sicher bist, dass es ein Abo/Vertrag ist.
Antworte "no" wenn es eindeutig eine einmalige Ausgabe ist (z.B. Restaurant, einzelner Einkauf).
Antworte "unsure" wenn es nicht eindeutig ist und ein Mensch das besser beurteilen kann.

Antworte NUR mit JSON: {"id1": "yes|no|unsure", ...} für jede id aus der Liste, sonst nichts.

Buchungen:
${list}`;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text()) as Record<string, "yes" | "no" | "unsure">;
  } catch (err) {
    console.error("[categorize] Vertragserkennung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return {};
  }
}

async function categorizeBatchWithGemini(
  rows: { id: string; vendor: string; amount: number }[],
): Promise<Record<string, string>> {
  if (rows.length === 0) return {};
  const model = getClient().getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });

  const list = rows.map((r) => `${r.id}|${r.vendor}|${r.amount.toFixed(2)}€`).join("\n");
  const categories = SPENDING_CATEGORIES.join(", ");
  const prompt = `Ordne jede Buchung (Format "id|Empfänger|Betrag") genau einer Kategorie zu: ${categories}.
Essen = Restaurants, Lieferdienste, Supermärkte, Cafés.
Transport = ÖPNV, Tanken, Parken, Bahn/Flug.
Arbeit = Arbeitsmittel, Coworking, Software fürs Business.
Spaß = Streaming, Gaming, Kino, Ausgehen, Hobbys.
Wohnen = Miete, Nebenkosten, Möbel, Haushalt.
Shopping = Kleidung, Elektronik, allgemeiner Einzelhandel/Onlineshops (auch Klarna-Ratenzahlungen).
Gesundheit = Apotheke, Arzt, Fitness.
Sonstiges = passt in keine der obigen Kategorien.

Antworte NUR mit JSON: {"id1": "Kategorie", "id2": "Kategorie", ...} für jede id aus der Liste unten, sonst nichts.

Buchungen:
${list}`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as Record<string, string>;
    return parsed;
  } catch (err) {
    console.error("[categorize] Gemini-Kategorisierung fehlgeschlagen:", err instanceof Error ? err.message : err);
    return {};
  }
}

const BATCH_SIZE = 40;

// Kategorisiert alle Buchungen eines Nutzers ohne Kategorie: erst wiederkehrende
// Zahlungen deterministisch erkennen, dann den Rest per Gemini in Kategorien
// wie Essen/Transport/Spaß einsortieren.
export async function categorizeUserTransactions(
  serviceClient: SupabaseClient,
  userId: string,
) {
  // Für die Recurring-Erkennung brauchen wir auch bereits kategorisierte
  // Buchungen als Kontext (z.B. ob ein Vendor schon mal als "Wiederkehrend"
  // erkannt wurde), holen aber nur die unkategorisierten für die eigentliche
  // Zuordnung.
  const { data: allTx, error: fetchErr } = await serviceClient
    .from("transactions")
    .select("id, vendor, amount, charged_at, category")
    .eq("user_id", userId);

  if (fetchErr) {
    console.error("[categorize] Konnte Buchungen nicht laden:", fetchErr.message);
    return { categorized: 0, recurring: 0 };
  }
  if (!allTx || allTx.length === 0) return { categorized: 0, recurring: 0 };

  const recurringIds = detectRecurringIds(allTx as TxRow[]);

  const toRecurring = (allTx as TxRow[]).filter(
    (t) => recurringIds.has(t.id) && t.category !== RECURRING_CATEGORY,
  );
  if (toRecurring.length > 0) {
    const { error } = await serviceClient
      .from("transactions")
      .update({ category: RECURRING_CATEGORY })
      .in("id", toRecurring.map((t) => t.id));
    if (error) console.error("[categorize] Update Wiederkehrend fehlgeschlagen:", error.message);
  }

  // Jede erkannte wiederkehrende Zahlung soll automatisch als "Debt"
  // (kind=subscription) sichtbar sein - nicht nur als Kategorie-Tag. Pro
  // Vendor-Gruppe wird ein Eintrag angelegt/aktualisiert (neuester Betrag +
  // geschätztes nächstes Fälligkeitsdatum).
  const recurringGroups = new Map<string, TxRow[]>();
  for (const t of allTx as TxRow[]) {
    if (!recurringIds.has(t.id)) continue;
    const key = normalizeVendor(t.vendor);
    if (!key) continue;
    if (!recurringGroups.has(key)) recurringGroups.set(key, []);
    recurringGroups.get(key)!.push(t);
  }
  for (const [vendorKey, rows] of recurringGroups) {
    const latest = [...rows].sort(
      (a, b) => new Date(b.charged_at).getTime() - new Date(a.charged_at).getTime(),
    )[0];
    try {
      await upsertSubscriptionDebt(
        serviceClient,
        userId,
        vendorKey,
        latest.vendor,
        Math.abs(latest.amount),
        latest.charged_at,
        latest.id,
      );
    } catch (err) {
      console.error("[categorize] Subscription-Debt-Upsert fehlgeschlagen:", err instanceof Error ? err.message : err);
    }
  }

  const remaining = (allTx as TxRow[]).filter(
    (t) => !recurringIds.has(t.id) && !t.category,
  );

  const batches: TxRow[][] = [];
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batches.push(remaining.slice(i, i + BATCH_SIZE));
  }

  // Batches parallel abarbeiten (begrenzte Nebenläufigkeit), damit z.B. ein
  // Backfill über 1000+ Buchungen nicht am Vercel-Timeout scheitert.
  const CONCURRENCY = 5;
  let categorized = 0;
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((batch) => categorizeBatchWithGemini(batch)));

    const updates: { id: string; category: string }[] = [];
    slice.forEach((batch, idx) => {
      const result = results[idx];
      for (const tx of batch) {
        const category = result[tx.id];
        if (category && SPENDING_CATEGORIES.includes(category as (typeof SPENDING_CATEGORIES)[number])) {
          updates.push({ id: tx.id, category });
        }
      }
    });

    await Promise.all(
      updates.map(async (u) => {
        const { error } = await serviceClient
          .from("transactions")
          .update({ category: u.category })
          .eq("id", u.id);
        if (!error) categorized++;
      }),
    );
  }

  // Für Buchungen, die noch keine 2. Wiederholung hatten (die deterministische
  // Erkennung greift erst ab dem 2. Vorkommen), fragen wir die KI, ob es sich
  // trotzdem schon um ein Abo/Vertrag handeln könnte - z.B. die erste
  // Netflix-Abbuchung. Bei "yes" wandert die Buchung direkt in Debts, bei
  // "unsure" landet eine Rückfrage im AI-Chat, bei "no" bleibt die normale
  // Kategorie stehen.
  const vendorCounts = new Map<string, number>();
  for (const t of allTx as TxRow[]) {
    const key = normalizeVendor(t.vendor);
    if (!key) continue;
    vendorCounts.set(key, (vendorCounts.get(key) ?? 0) + 1);
  }
  const singleOccurrence = remaining.filter((t) => (vendorCounts.get(normalizeVendor(t.vendor)) ?? 0) < 2);

  const { data: existingReviews } = await serviceClient
    .from("pending_reviews")
    .select("transaction_id")
    .eq("user_id", userId);
  const alreadyReviewed = new Set((existingReviews ?? []).map((r) => r.transaction_id));

  const candidateBatches: TxRow[][] = [];
  for (let i = 0; i < singleOccurrence.length; i += BATCH_SIZE) {
    candidateBatches.push(singleOccurrence.slice(i, i + BATCH_SIZE));
  }

  let recurringFromAi = 0;
  for (let i = 0; i < candidateBatches.length; i += CONCURRENCY) {
    const slice = candidateBatches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((batch) => detectContractCandidates(batch)));

    for (let idx = 0; idx < slice.length; idx++) {
      const batch = slice[idx];
      const result = results[idx];
      for (const tx of batch) {
        const guess = result[tx.id];
        if (!guess) continue;

        if (guess === "yes") {
          await serviceClient.from("transactions").update({ category: RECURRING_CATEGORY }).eq("id", tx.id);
          try {
            await upsertSubscriptionDebt(
              serviceClient,
              userId,
              normalizeVendor(tx.vendor),
              tx.vendor,
              Math.abs(tx.amount),
              tx.charged_at,
              tx.id,
            );
            recurringFromAi++;
          } catch (err) {
            console.error("[categorize] Subscription-Debt (KI) fehlgeschlagen:", err instanceof Error ? err.message : err);
          }
        } else if (guess === "unsure" && !alreadyReviewed.has(tx.id)) {
          await serviceClient.from("pending_reviews").insert({
            user_id: userId,
            transaction_id: tx.id,
            vendor: tx.vendor,
            amount: Math.abs(tx.amount),
            question: `Ist "${tx.vendor}" (${Math.abs(tx.amount).toFixed(2)}€) ein Abo oder Vertrag?`,
            ai_guess: "unsure",
          });
        }
      }
    }
  }

  return { categorized, recurring: toRecurring.length + recurringFromAi };
}
