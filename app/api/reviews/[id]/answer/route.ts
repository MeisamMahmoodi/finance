import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePendingReview } from "@/lib/reviews";

// Beantwortet eine unsichere KI-Rückfrage ("ist das ein Vertrag?"): bei "yes"
// wandert die Buchung in Debts (kind=subscription) und wird als Wiederkehrend
// kategorisiert, bei "no" bleibt sie wie sie ist. Die Entscheidung wird pro
// Empfänger als Regel gespeichert, damit die KI beim nächsten Mal für
// denselben Empfänger nicht erneut nachfragt, sondern die Antwort merkt.
// Die eigentliche Logik steckt in lib/reviews.ts, damit sowohl diese Route
// (Ja/Nein-Buttons im Chat) als auch das KI-Tool (wenn Gemini die Rückfrage
// selbst im Gespräch auflöst) dieselbe Implementierung nutzen.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const answer = body?.answer === "yes" ? "yes" : body?.answer === "no" ? "no" : null;
  if (!answer) {
    return NextResponse.json({ error: "answer muss 'yes' oder 'no' sein" }, { status: 400 });
  }

  try {
    const result = await resolvePendingReview(supabase, user.id, id, answer);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 404 });
  }
}
