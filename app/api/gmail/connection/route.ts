import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Trennt die Gmail-Verbindung. Bereits importierte Transaktionen bleiben erhalten.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { error } = await supabase.from("email_connections").delete().eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
