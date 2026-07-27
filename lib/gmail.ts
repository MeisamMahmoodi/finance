export type GmailMessage = {
  id: string;
  subject: string;
  from: string;
  date: string;
  bodyText: string;
};

// Absender/Betreff-Filter für Rechnungen, Abos und Kaufbestätigungen.
const SEARCH_QUERY =
  "(from:apple.com OR from:amazon.de OR from:amazon.com OR from:otto.de OR " +
  "from:openai.com OR from:anthropic.com OR from:google.com OR from:netflix.com OR " +
  "from:spotify.com OR subject:rechnung OR subject:invoice OR subject:receipt OR " +
  "subject:quittung OR subject:bestellbestätigung OR subject:zahlungsbestätigung) " +
  "newer_than:35d";

export async function listCandidateMessageIds(
  accessToken: string,
  maxResults = 25,
): Promise<string[]> {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", SEARCH_QUERY);
  url.searchParams.set("maxResults", String(maxResults));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail search failed: ${await res.text()}`);
  const data = (await res.json()) as { messages?: { id: string }[] };
  return (data.messages ?? []).map((m) => m.id);
}

function decodeBase64Url(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

function extractBody(part: GmailPart): { plain: string; html: string } {
  let plain = "";
  let html = "";

  if (part.mimeType === "text/plain" && part.body?.data) {
    plain += decodeBase64Url(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data) {
    html += decodeBase64Url(part.body.data);
  }

  if (part.parts) {
    for (const child of part.parts) {
      const nested = extractBody(child);
      plain += nested.plain;
      html += nested.html;
    }
  }

  return { plain, html };
}

export async function getMessageDetail(
  accessToken: string,
  id: string,
): Promise<GmailMessage> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail message fetch failed: ${await res.text()}`);
  const data = await res.json();

  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const { plain, html } = extractBody(data.payload ?? {});
  const bodyText = (plain || stripHtml(html) || data.snippet || "").slice(0, 4000);

  return {
    id,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    date: getHeader("Date"),
    bodyText,
  };
}
