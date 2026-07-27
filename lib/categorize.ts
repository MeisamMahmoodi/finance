import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Kategorien: "Wiederkehrend" ist speziell — nur echte Verträge/Abos landen
// hier (per KI bestätigt). Alle anderen Kategorien ordnet Gemini den
// restlichen Buchungen zu.
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

// BNPL-/Ratenzahlungsdienste taggen jede Einzelbuchung (egal welcher
// tatsächliche Händler dahintersteckt) mit demselben Empfängernamen. Zwei
// unterschiedliche Einkäufe können dadurch zufällig denselben Betrag im
// ~monatlichen Abstand haben (z.B. zwei verschiedene Klarna-Käufe à 26,29€).
// Das ist Zufall, kein Vertrag - diese Vendors werden daher NIE automatisch
// als Abo erkannt.
const BNPL_DENYLIST = ["klarna", "afterpay", "clearpay", "ratepay", "riverty", "billpay", "unzer"];

// Generische Zahlungsdienstleister (PayPal etc.) können ECHTE Abos abwickeln
// (Netflix/Spotify laufen oft über PayPal) - aber wir sehen nur "PayPal",
// nicht den echten Händler dahinter. Bei diesen wird ein erkanntes Muster nie
// automatisch bestätigt, sondern immer als Rückfrage an den Nutzer gestellt.
const AMBIGUOUS_PAYMENT_PROCESSORS = ["paypal", "stripe", "adyen", "mollie", "sumup"];

function vendorMatches(vendorKey: string, list: string[]) {
  return list.some((kw) => vendorKey.includes(kw));
}

// Findet Vendor-Gruppen, deren Zahlungsmuster nach Abo/Vertrag AUSSIEHT
// (gleicher Empfänger, sehr ähnlicher Betrag, ~monatlicher Abstand). Das ist
// nur eine Kandidaten-Vorauswahl - ob es wirklich ein Vertrag ist (und kein
// zufällig ähnlicher Wocheneinkauf beim Supermarkt), entscheidet danach die
// KI anhand des Empfängernamens.
function buildRecurringCandidateGroups(transactions: TxRow[]): Map<string, TxRow[]> {
  const byVendor = new Map<string, TxRow[]>();
  for (const tx of transactions) {
    const key = normalizeVendor(tx.vendor);
    if (!key || vendorMatches(key, BNPL_DENYLIST)) continue;
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(tx);
  }

  const candidateIds = new Set<string>();
  for (const rows of byVendor.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort(
      (a, b) => new Date(a.charged_at).getTime() - new Date(b.charged_at).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const daysApart = (new Date(cur.charged_at).getTime() - new Date(prev.charged_at).getTime()) / 86_400_000;
      // Echte Verträge/Abos berechnen fast immer exakt denselben Betrag -
      // enge Toleranz (6%) statt der früheren 20%, sonst matchen zufällig
      // ähnliche Supermarkt-Einkäufe im ~monatlichen Abstand.
      const amountDiff = Math.abs(cur.amount - prev.amount) / Math.max(prev.amount, 1);
      if (daysApart >= 25 && daysApart <= 35 && amountDiff <= 0.06) {
        candidateIds.add(prev.id);
        candidateIds.add(cur.id);
      }
    }
  }

  const groups = new Map<string, TxRow[]>();
  for (const [key, rows] of byVendor) {
    const matched = rows.filter((r) => candidateIds.has(r.id));
    if (matched.length >= 2) groups.set(key, matched);
  }
  return groups;
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

// Legt für eine KI-bestätigte wiederkehrende Zahlung einen "Debt"-Eintrag vom
// Typ Subscription an bzw. aktualisiert ihn, damit die Debts-Seite
// automatisch alle Verträge/Abos auflistet - ohne dass der Nutzer sie
// manuell eintragen muss.
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

type ContractCandidate = { id: string; vendor: string; amount: number; occurrences: number };

// EINE geteilte KI-Prüfung für "ist das ein Vertrag/Abo?" - egal ob die
// Buchung schon mehrfach mit ähnlichem Betrag/Abstand aufgetaucht ist
// (occurrences >= 2) oder erst zum ersten Mal (occurrences = 1, z.B. die
// erste Netflix-Abbuchung). Entscheidend ist der Empfängername, nicht nur
// das Zahlungsmuster - ein Supermarkt bleibt ein Supermarkt, auch wenn der
// Wocheneinkauf zufällig immer ~gleich teuer ist.
async function classifyContractCandidates(
  rows: ContractCandidate[],
): Promise<Record<string, "yes" | "no" | "unsure">> {
  if (rows.length === 0) return {};
  const model = getClient().getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: { responseMimeType: "application/json" },
  });

  const list = rows
    .map((r) => `${r.id}|${r.vendor}|${r.amount.toFixed(2)}€|${r.occurrences}x gesehen`)
    .join("\n");

  const prompt = `Für jede Buchung (Format "id|Empfänger|Betrag|Häufigkeit") schätze anhand des EMPFÄNGERNAMENS ein, ob es sich um ein Abo oder einen Vertrag handelt.

Antworte "yes" NUR wenn der Empfängername klar zu einem Vertrags-/Abo-Typ-Unternehmen passt:
Streaming (Netflix, Spotify, Disney+), Telekommunikation (Handyvertrag, Internet/DSL), Versicherung, Miete/Nebenkosten/Hausverwaltung, Fitnessstudio/Mitgliedschaft, Software-Abo (OpenAI, Adobe, iCloud, Microsoft 365), Kredit-/Ratenzahlung (Klarna, Bank-Finanzierung), ÖPNV-Zeitkarte/Deutschlandticket, Rundfunkbeitrag.

Antworte "no" wenn der Empfängername klar zu etwas anderem gehört, AUCH WENN der Betrag sich wiederholt oder ähnlich ist:
Supermarkt/Lebensmittel (Penny, Edeka, Rewe, Aldi, Lidl), Tankstelle, Restaurant/Lieferdienst, Drogerie, allgemeiner Einzelhandel/Online-Shop (Amazon, Zalando für Einzelkäufe), Überweisung an eine Privatperson. Ein wöchentlicher Wocheneinkauf mit ähnlichem Betrag ist KEIN Abo, auch nicht bei "X mal gesehen" > 1.

Antworte "unsure" nur wenn der Name selbst nicht eindeutig einer der beiden Gruppen zuzuordnen ist (z.B. ein reiner Zahlungsdienstleister wie PayPal ohne erkennbaren echten Empfänger).

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
Transport = ÖPNV-Einzelfahrten, Tanken, Parken, Bahn/Flug.
Arbeit = Arbeitsmittel, Coworking, Software fürs Business.
Spaß = Gaming, Kino, Ausgehen, Hobbys.
Wohnen = Möbel, Haushalt (laufende Miete/Nebenkosten sind bereits als Wiederkehrend erfasst).
Shopping = Kleidung, Elektronik, allgemeiner Einzelhandel/Onlineshops.
Gesundheit = Apotheke, Arzt.
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
const CONCURRENCY = 5;

async function runClassifyBatches(candidates: ContractCandidate[]) {
  const merged: Record<string, "yes" | "no" | "unsure"> = {};
  const batches: ContractCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const slice = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(slice.map((batch) => classifyContractCandidates(batch)));
    results.forEach((r) => Object.assign(merged, r));
  }
  return merged;
}

// Kategorisiert alle Buchungen eines Nutzers ohne Kategorie:
// 1. Kandidaten für Verträge/Abos sammeln (wiederholtes Zahlungsmuster ODER
//    einzelne neue Buchung) und per KI anhand des Empfängernamens bestätigen
//    lassen - nur bei "yes" wird daraus ein Debt-Eintrag, bei "unsure" eine
//    Rückfrage im Chat, bei "no" bleibt es eine normale Buchung.
// 2. Den Rest per Gemini in Kategorien wie Essen/Transport/Spaß einsortieren.
export async function categorizeUserTransactions(
  serviceClient: SupabaseClient,
  userId: string,
) {
  const { data: allTx, error: fetchErr } = await serviceClient
    .from("transactions")
    .select("id, vendor, amount, charged_at, category")
    .eq("user_id", userId);

  if (fetchErr) {
    console.error("[categorize] Konnte Buchungen nicht laden:", fetchErr.message);
    return { categorized: 0, recurring: 0 };
  }
  if (!allTx || allTx.length === 0) return { categorized: 0, recurring: 0 };

  const rows = allTx as TxRow[];
  const uncategorized = rows.filter((t) => !t.category);

  // Kandidaten Gruppe A: Vendor-Gruppen mit wiederholtem, engem Zahlungsmuster.
  const recurringGroups = buildRecurringCandidateGroups(rows);
  const groupedIds = new Set<string>();
  for (const groupRows of recurringGroups.values()) {
    for (const r of groupRows) groupedIds.add(r.id);
  }

  // Kandidaten Gruppe B: alles andere ohne Kategorie, das noch keiner
  // Mehrfach-Gruppe angehört (z.B. die allererste Abbuchung eines neuen Abos).
  const vendorCounts = new Map<string, number>();
  for (const t of rows) {
    const key = normalizeVendor(t.vendor);
    if (!key) continue;
    vendorCounts.set(key, (vendorCounts.get(key) ?? 0) + 1);
  }
  const singleOccurrence = uncategorized.filter(
    (t) => !groupedIds.has(t.id) && !vendorMatches(normalizeVendor(t.vendor), BNPL_DENYLIST),
  );

  const candidates: (ContractCandidate & { groupIds?: string[] })[] = [];
  for (const [vendorKey, groupRows] of recurringGroups) {
    // Nur prüfen, wenn mindestens eine Buchung der Gruppe noch keine
    // Kategorie hat oder noch nicht als Wiederkehrend markiert ist - sonst
    // unnötige wiederholte KI-Aufrufe bei jedem Sync.
    const needsCheck = groupRows.some((r) => r.category !== RECURRING_CATEGORY);
    if (!needsCheck) continue;
    const latest = [...groupRows].sort(
      (a, b) => new Date(b.charged_at).getTime() - new Date(a.charged_at).getTime(),
    )[0];
    candidates.push({
      id: latest.id,
      vendor: latest.vendor,
      amount: Math.abs(latest.amount),
      occurrences: groupRows.length,
      groupIds: groupRows.map((r) => r.id),
    });
    void vendorKey;
  }
  for (const t of singleOccurrence) {
    candidates.push({ id: t.id, vendor: t.vendor, amount: Math.abs(t.amount), occurrences: 1 });
  }

  const { data: existingReviews } = await serviceClient
    .from("pending_reviews")
    .select("transaction_id")
    .eq("user_id", userId);
  const alreadyReviewed = new Set((existingReviews ?? []).map((r) => r.transaction_id));

  const verdicts = await runClassifyBatches(candidates);

  const confirmedRecurringIds = new Set<string>();
  let recurringFromAi = 0;
  for (const candidate of candidates) {
    let verdict = verdicts[candidate.id];
    const memberIds = candidate.groupIds ?? [candidate.id];

    // Generische Zahlungsdienstleister (PayPal etc.): auch bei "yes" nie
    // automatisch bestätigen, weil wir den echten Empfänger dahinter nicht
    // kennen - stattdessen den Nutzer fragen.
    if (verdict === "yes" && vendorMatches(normalizeVendor(candidate.vendor), AMBIGUOUS_PAYMENT_PROCESSORS)) {
      verdict = "unsure";
    }

    if (verdict === "yes") {
      const { error } = await serviceClient
        .from("transactions")
        .update({ category: RECURRING_CATEGORY })
        .in("id", memberIds);
      if (error) console.error("[categorize] Update Wiederkehrend fehlgeschlagen:", error.message);
      for (const id of memberIds) confirmedRecurringIds.add(id);

      try {
        await upsertSubscriptionDebt(
          serviceClient,
          userId,
          normalizeVendor(candidate.vendor),
          candidate.vendor,
          candidate.amount,
          rows.find((r) => r.id === candidate.id)?.charged_at ?? new Date().toISOString(),
          candidate.id,
        );
        recurringFromAi++;
      } catch (err) {
        console.error("[categorize] Subscription-Debt-Upsert fehlgeschlagen:", err instanceof Error ? err.message : err);
      }
    } else if (verdict === "unsure" && !alreadyReviewed.has(candidate.id)) {
      await serviceClient.from("pending_reviews").insert({
        user_id: userId,
        transaction_id: candidate.id,
        vendor: candidate.vendor,
        amount: candidate.amount,
        question: `Ist "${candidate.vendor}" (${candidate.amount.toFixed(2)}€) ein Abo oder Vertrag?`,
        ai_guess: "unsure",
      });
    }
    // "no" oder kein Verdict: nichts weiter tun, Buchung durchläuft unten die
    // normale Kategorisierung wie jede andere Ausgabe.
  }

  const remaining = rows.filter((t) => !t.category && !confirmedRecurringIds.has(t.id));

  const batches: TxRow[][] = [];
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    batches.push(remaining.slice(i, i + BATCH_SIZE));
  }

  // Batches parallel abarbeiten (begrenzte Nebenläufigkeit), damit z.B. ein
  // Backfill über 1000+ Buchungen nicht am Vercel-Timeout scheitert.
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

  return { categorized, recurring: recurringFromAi };
}
