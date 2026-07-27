import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const delta = Number(body?.delta);
  if (!Number.isFinite(delta)) {
    return NextResponse.json({ error: "Ungültiger Betrag" }, { status: 400 });
  }

  const { data: box } = await supabase
    .from("boxes")
    .select("saved_amount")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!box) {
    return NextResponse.json({ error: "Box nicht gefunden" }, { status: 404 });
  }

  const newSaved = Math.max(0, Number(box.saved_amount) + delta);

  const { error } = await supabase.from("boxes").update({ saved_amount: newSaved }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, saved_amount: newSaved });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { error } = await supabase.from("boxes").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
