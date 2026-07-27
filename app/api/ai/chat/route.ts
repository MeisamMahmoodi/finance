import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { computeCategoryBreakdown, computeMonthlyFixed, predictNextMonthTotal } from "@/lib/stats";
import type { Transaction } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return client;
}

// Echter Chat-Assistent: bekommt die Ausgaben/Debts des Nutzers als Kontext
// und beantwortet Fragen dazu (z.B. "wie viel hab ich für Essen ausgegeben").
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
  if (!message) {
    return NextResponse.json({ error: "Nachricht fehlt" }, { status: 400 });
  }

  const [{ data: txData }, { data: debts }, { data: history }] = await Promise.all([
    supabase.from("transactions").select("*").order("charged_at", { ascending: true }),
    supabase.from("debts").select("*").order("next_due_date", { ascending: true }),
    supabase
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const transactions = (txData ?? []) as Transaction[];
  const categoryTotals = computeCategoryBreakdown(transactions);
  const fixed = computeMonthlyFixed(transactions);
  const prediction = predictNextMonthTotal(transactions);

  const contextLines = [
    `Fixkosten/Abos pro Monat: ${currencyFormat.format(fixed)}`,
    prediction !== null ? `Prognose nächster Monat (Gesamtausgaben): ${currencyFormat.format(prediction)}` : null,
    "Ausgaben diesen Monat nach Kategorie:",
    ...categoryTotals.map((c) => `  ${c.category}: ${currencyFormat.format(c.total)}`),
    "Verträge/Abos (Debts):",
    ...(debts ?? []).map(
      (d) =>
        `  ${d.name}: ${currencyFormat.format(d.total_amount)}${d.kind === "loan" ? ` (${d.installments_paid}/${d.installments_total} Raten bezahlt)` : " (Abo)"}`,
    ),
    "Letzte Buchungen:",
    ...transactions
      .slice(-15)
      .reverse()
      .map((t) => `  ${new Date(t.charged_at).toLocaleDateString("de-DE")} ${t.vendor}: ${currencyFormat.format(t.amount)} (${t.category ?? "unkategorisiert"})`),
  ]
    .filter(Boolean)
    .join("\n");

  const conversation = (history ?? [])
    .map((m) => `${m.role === "user" ? "Nutzer" : "Assistent"}: ${m.content}`)
    .join("\n");

  const prompt = `Du bist ein persönlicher Finanz-Assistent in einer privaten Finance-App. Antworte kurz, konkret und auf Deutsch. Nutze die folgenden echten Finanzdaten des Nutzers als Grundlage für deine Antwort. Erfinde keine Zahlen, die nicht aus den Daten hervorgehen.

Finanzdaten:
${contextLines}

${conversation ? `Bisheriger Chat-Verlauf:\n${conversation}\n` : ""}
Neue Nutzerfrage: ${message}

Antworte direkt, ohne die Frage zu wiederholen.`;

  let reply = "Entschuldigung, ich konnte gerade nicht antworten.";
  try {
    const model = getClient().getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    reply = result.response.text().trim() || reply;
  } catch (err) {
    console.error("[ai-chat] Gemini-Anfrage fehlgeschlagen:", err instanceof Error ? err.message : err);
  }

  await supabase.from("chat_messages").insert([
    { user_id: user.id, role: "user", content: message },
    { user_id: user.id, role: "assistant", content: reply },
  ]);

  return NextResponse.json({ reply });
}
