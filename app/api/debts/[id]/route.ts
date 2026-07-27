import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Generisches Bearbeiten/Löschen eines Debt-Eintrags (Kredit, Abo oder
// Rechnung) - z.B. um bei einer Rechnung nachträglich Betrag/Tag/Fälligkeit
// zu ändern, oder einen falsch erfassten Eintrag zu entfernen.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const updates: Record<string, unknown> = {};

  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body?.total_amount !== undefined && Number.isFinite(Number(body.total_amount))) {
    updates.total_amount = Number(body.total_amount);
  }
  if (body?.next_due_date !== undefined) updates.next_due_date = body.next_due_date || null;
  if (body?.tag !== undefined) updates.tag = typeof body.tag === "string" && body.tag.trim() ? body.tag.trim() : null;
  if (body?.installments_total !== undefined && Number.isFinite(Number(body.installments_total))) {
    updates.installments_total = Math.max(1, Math.round(Number(body.installments_total)));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen übergeben" }, { status: 400 });
  }

  const { error } = await supabase.from("debts").update(updates).eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
