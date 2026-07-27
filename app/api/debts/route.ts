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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const totalAmount = Number(body?.total_amount);
  const installmentsTotal = Number(body?.installments_total) || 1;
  const nextDueDate = typeof body?.next_due_date === "string" ? body.next_due_date : null;

  if (!name || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: "Name und Gesamtbetrag erforderlich" }, { status: 400 });
  }

  const { error } = await supabase.from("debts").insert({
    user_id: user.id,
    name,
    total_amount: totalAmount,
    installments_total: Math.max(1, Math.round(installmentsTotal)),
    next_due_date: nextDueDate,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
