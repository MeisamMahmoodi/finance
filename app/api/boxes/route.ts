import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const COLORS = ["#8b8bff", "#5dcaa5", "#e2504a", "#f2c94c", "#56ccf2"];

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
  const targetAmount = body?.target_amount != null ? Number(body.target_amount) : null;

  if (!name) {
    return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
  }

  const { count } = await supabase
    .from("boxes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const color = COLORS[(count ?? 0) % COLORS.length];

  const { error } = await supabase.from("boxes").insert({
    user_id: user.id,
    name,
    target_amount: Number.isFinite(targetAmount) ? targetAmount : null,
    color,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
