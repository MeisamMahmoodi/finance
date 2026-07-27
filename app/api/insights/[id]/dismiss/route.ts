import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Markiert einen proaktiven KI-Hinweis als gelesen/erledigt, damit er nicht
// bei jedem Öffnen des Chats erneut ganz oben auftaucht.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { error } = await supabase.from("ai_insights").update({ dismissed: true }).eq("id", id).eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
