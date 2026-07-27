import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const monthlyIncome = Number(body?.monthly_income);
  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
    return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: user.id, monthly_income: monthlyIncome, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
