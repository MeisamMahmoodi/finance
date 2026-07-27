import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manuelles Erfassen einer Ein-/Ausgabe (z.B. Bargeld, oder eine Buchung, die
// weder per Gmail noch per Bank erfasst wurde).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const vendor = typeof body?.vendor === "string" ? body.vendor.trim() : "";
  const amount = Number(body?.amount);
  const direction = body?.direction === "in" ? "in" : "out";
  const category = typeof body?.category === "string" && body.category ? body.category : null;
  const chargedAt = typeof body?.charged_at === "string" && body.charged_at ? body.charged_at : new Date().toISOString();

  if (!vendor || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Name und Betrag erforderlich" }, { status: 400 });
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    vendor,
    amount,
    direction,
    category,
    charged_at: chargedAt,
    source: "manual",
    status: "completed",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
