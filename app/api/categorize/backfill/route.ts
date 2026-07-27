import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { categorizeUserTransactions } from "@/lib/categorize";

export const maxDuration = 60;

// Einmaliger (oder wiederholbarer) manueller Trigger, um bereits importierte
// Buchungen ohne Kategorie nachträglich einzuordnen (Backfill für Bestand
// vor Einführung der Kategorisierung).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const serviceClient = createServiceClient();
  try {
    const result = await categorizeUserTransactions(serviceClient, user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Kategorisierung fehlgeschlagen" },
      { status: 500 },
    );
  }
}
