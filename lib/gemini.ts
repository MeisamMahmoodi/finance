import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GmailMessage } from "@/lib/gmail";

export type ExtractedInvoice = {
  is_invoice: boolean;
  vendor?: string;
  amount?: number;
  currency?: string;
  charged_at?: string;
  category?: string;
};

let client: GoogleGenerativeAI | null = null;
function getClient() {
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return client;
}

export async function extractInvoiceFromEmail(
  email: GmailMessage,
): Promise<ExtractedInvoice> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `Du bekommst eine E-Mail (Betreff, Absender, Datum, Textauszug) aus einem privaten Postfach.
Bestimme, ob es sich um eine Rechnung, Kaufbestätigung oder Abo-Abbuchung handelt
(z.B. Apple, Amazon, Otto, OpenAI, Software-Abos, Streaming-Dienste). Newsletter,
Werbung oder sonstige Mails ohne konkreten Rechnungsbetrag zählen nicht.

Antworte NUR mit JSON in diesem Schema, ohne weitere Erklärung:
{"is_invoice": boolean, "vendor": string, "amount": number, "currency": string, "charged_at": "YYYY-MM-DD", "category": string}

category ist eine kurze deutsche Kategorie wie "Abo", "KI-Dienst", "Einkauf", "Fixkosten" o.ä.
Falls is_invoice false ist, lass die anderen Felder weg.

E-Mail:
Betreff: ${email.subject}
Von: ${email.from}
Datum: ${email.date}
Text: ${email.bodyText}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as ExtractedInvoice;
    console.log(
      `[gemini] "${email.subject}" von ${email.from} -> is_invoice=${parsed.is_invoice} amount=${parsed.amount}`,
    );
    return parsed;
  } catch (err) {
    console.error(
      `[gemini] Fehler bei "${email.subject}" von ${email.from}:`,
      err instanceof Error ? err.message : err,
    );
    return { is_invoice: false };
  }
}
