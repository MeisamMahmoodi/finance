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

  return { categorized, recurring: toRecurring.length };
}
