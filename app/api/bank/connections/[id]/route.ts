import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Trennt eine Bank-/Fintech-Verbindung. bank_accounts (und darüber
// bank_balance_history) hängen per ON DELETE CASCADE dran und werden
// automatisch mitgelöscht. Bereits importierte Transaktionen bleiben erhalten.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { error } = await supabase.from("bank_connections").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
