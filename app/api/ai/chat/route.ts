import { NextResponse } from "next/server";
import { GoogleGenerativeAI, type Content, type Part } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { computeCategoryBreakdown, computeMonthlyFixed, predictNextMonthTotal } from "@/lib/stats";
import { AI_TOOLS, executeAiTool } from "@/lib/ai-tools";
import type { Transaction } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const MAX_TOOL_ROUNDS = 6;

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return client;
}

// Echter Chat-Assistent mit Function-Calling: bekommt die Ausgaben/Debts des
// Nutzers als Kontext UND echte Werkzeuge (lib/ai-tools.ts), mit denen er
// Transaktionen/Debts lesen, anlegen, ändern, löschen und offene Rückfragen
// direkt im Gespräch auflösen kann - nicht nur darüber reden. Unterstützt
// zusätzlich ein optionales Foto (Beleg/Rechnung), das Gemini multimodal
// ausliest und daraufhin selbst über die Tools einträgt.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const image =
    body?.image && typeof body.image.data === "string" && typeof body.image.mimeType === "string"
      ? (body.image as { data: string; mimeType: string })
      : null;

  if (!message && !image) {
    return NextResponse.json({ error: "Nachricht oder Foto fehlt" }, { status: 400 });
  }

  const [{ data: txData }, { data: debts }, { data: historyDesc }] = await Promise.all([
    supabase.from("transactions").select("*").order("charged_at", { ascending: true }),
    supabase.from("debts").select("*").order("next_due_date", { ascending: true }),
    // Absteigend + limit, damit die KI die NEUESTEN 20 Nachrichten als
    // Kontext bekommt statt für immer nur die ältesten 20 (sonst "vergisst"
    // die KI jede neuere Konversation, sobald mehr als 20 Nachrichten
    // insgesamt existieren).
    supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const history = historyDesc ? [...historyDesc].reverse() : historyDesc;

  const transactions = (txData ?? []) as Transaction[];
  const categoryTotals = computeCategoryBreakdown(transactions);
  const fixed = computeMonthlyFixed(transactions);
  const prediction = predictNextMonthTotal(transactions);

  const contextLines = [
    `Fixkosten/Abos pro Monat: ${currencyFormat.format(fixed)}`,
    prediction !== null ? `Prognose nächster Monat (Gesamtausgaben): ${currencyFormat.format(prediction)}` : null,
    "Ausgaben diesen Monat nach Kategorie:",
    ...categoryTotals.map((c) => `  ${c.category}: ${currencyFormat.format(c.total)}`),
    "Verträge/Abos/Rechnungen (Debts):",
    ...(debts ?? []).map(
      (d) =>
        `  [${d.id}] ${d.name}: ${currencyFormat.format(d.total_amount)}${
          d.kind === "loan"
            ? ` (Kredit, ${d.installments_paid}/${d.installments_total} Raten bezahlt)`
            : d.kind === "invoice"
              ? ` (Rechnung${d.tag ? `, ${d.tag}` : ""}${d.amount_paid >= d.total_amount ? ", bezahlt" : ", offen"})`
              : " (Abo)"
        }`,
    ),
    "Letzte Buchungen:",
    ...transactions
      .slice(-15)
      .reverse()
      .map(
        (t) =>
          `  [${t.id}] ${new Date(t.charged_at).toLocaleDateString("de-DE")} ${t.vendor}: ${currencyFormat.format(t.amount)} (${t.category ?? "unkategorisiert"})`,
      ),
  ]
    .filter(Boolean)
    .join("\n");

  const systemInstruction = `Du bist ein persönlicher Finanz-Assistent in einer privaten Finance-App. Antworte kurz, konkret und auf Deutsch.

WICHTIGSTE REGEL - NIEMALS ERFINDEN: Erfinde niemals Vendor-Namen, Beträge, Daten oder Fälligkeiten, die dir nicht durch echte Finanzdaten unten oder ein tatsächliches Tool-Ergebnis vorliegen. Wenn der Nutzer dich bittet, etwas einzutragen ("trag meine Klarna-Kosten ein", "füg das hinzu"), ohne dir konkrete Beträge/Namen/Daten zu nennen und ohne Foto - errate NICHTS. Frag stattdessen kurz nach den konkreten Werten, oder nutze list_transactions um echte, bereits vorhandene Buchungen zu finden und zeige dem Nutzer genau diese zur Bestätigung, bevor du irgendetwas anlegst/änderst.

WICHTIGSTE REGEL - NIEMALS FALSCH BEHAUPTEN: Sag niemals "ich habe X eingetragen/gelöscht/geändert", wenn du nicht wirklich die entsprechende Funktion aufgerufen hast und ein Erfolg zurückkam. Wenn ein Tool-Aufruf einen Fehler zurückgibt, sag das ehrlich statt es zu verschweigen.

Du hast über Funktionen echten Zugriff auf das gesamte System: Transaktionen und Debts (Kredite, Abos, Rechnungen) auflisten, anlegen, ändern, löschen, sowie offene KI-Rückfragen ("ist X ein Vertrag?") direkt beantworten. Nutze diese Funktionen aktiv, wenn der Nutzer klare, konkrete Angaben macht - z.B. "lösch die Amazon-Buchung", "trag 20€ Tanken für heute ein", "markier die Zahnarzt-Rechnung als bezahlt". Bekommst du ein Foto eines Belegs/einer Rechnung, lies Empfänger, Betrag, Datum/Fälligkeit und Kategorie so genau wie möglich aus dem Bild heraus (nicht raten) und trage es über create_transaction (bereits bezahlter Kauf) oder create_invoice (offene Rechnung mit Fälligkeitsdatum) ein - fasse danach kurz zusammen, was genau du aus dem Foto gelesen und eingetragen hast, damit der Nutzer es prüfen kann. Falls das Foto unscharf/unlesbar ist oder du dir bei einem Wert nicht sicher bist, sag das explizit statt einen Wert zu erfinden.

WICHTIG bei "verschieb X zu den Abos/Verträgen/Krediten/Rechnungen" o.ä.: Das bedeutet, den Eintrag wirklich in die andere Sektion zu verschieben - dafür MUSST du update_debt mit dem Parameter "kind" aufrufen (kind: "subscription" = Verträge & Abos, "loan" = Kredite & Raten, "invoice" = Rechnungen). Nur einen Tag zu setzen reicht nicht aus und verändert die Sektion nicht - der Nutzer merkt sofort, wenn sich nichts sichtbar geändert hat.

Aktuelle Finanzdaten (IDs in eckigen Klammern kannst du für update_/delete_-Aufrufe verwenden):
${contextLines}`;

  const conversationHistory: Content[] = (history ?? []).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const userParts: Part[] = [];
  if (image) {
    userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  }
  userParts.push({
    text: message || "Lies das angehängte Foto (Beleg/Rechnung) aus und trage es passend ein.",
  });

  let reply = "Entschuldigung, ich konnte gerade nicht antworten.";
  try {
    const model = getClient().getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      tools: AI_TOOLS,
      systemInstruction,
      // Niedrige Temperature = weniger "kreatives" Erfinden von Zahlen/Namen,
      // präzisere und konsistentere Antworten auf Basis der echten Daten.
      generationConfig: { temperature: 0.25 },
    });
    const chat = model.startChat({ history: conversationHistory });

    let result = await chat.sendMessage(userParts);
    let calls = result.response.functionCalls();
    let round = 0;

    while (calls && calls.length > 0 && round < MAX_TOOL_ROUNDS) {
      round++;
      const responseParts: Part[] = [];
      for (const call of calls) {
        const output = await executeAiTool(supabase, user.id, call.name, (call.args ?? {}) as Record<string, unknown>);
        responseParts.push({ functionResponse: { name: call.name, response: output as object } });
      }
      result = await chat.sendMessage(responseParts);
      calls = result.response.functionCalls();
    }

    reply = result.response.text().trim() || reply;
  } catch (err) {
    console.error("[ai-chat] Gemini-Anfrage fehlgeschlagen:", err instanceof Error ? err.message : err);
  }

  await supabase.from("chat_messages").insert([
    { user_id: user.id, role: "user", content: message || "[Foto gesendet]" },
    { user_id: user.id, role: "assistant", content: reply },
  ]);

  return NextResponse.json({ reply });
}
