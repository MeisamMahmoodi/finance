import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECURRING_CATEGORY, normalizeVendor } from "@/lib/categorize";

// Beantwortet eine unsichere KI-Rückfrage ("ist das ein Vertrag?"): bei "yes"
// wandert die Buchung in Debts (kind=subscription) und wird als Wiederkehrend
// kategorisiert, bei "no" bleibt sie wie sie ist. Die Entscheidung wird pro
// Empfänger als Regel gespeichert, damit die KI beim nächsten Mal für
// denselben Empfänger nicht erneut nachfragt, sondern die Antwort merkt.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const answer = body?.answer === "yes" ? "yes" : body?.answer === "no" ? "no" : null;
  if (!answer) {
    return NextResponse.json({ error: "answer muss 'yes' oder 'no' sein" }, { status: 400 });
  }

  const { data: review, error: fetchError } = await supabase
    .from("pending_reviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !review) {
    return NextResponse.json({ error: "Rückfrage nicht gefunden" }, { status: 404 });
  }

  const vendorKey = normalizeVendor(review.vendor);

  await supabase.from("vendor_rules").upsert(
    { user_id: user.id, vendor_key: vendorKey, decision: answer === "yes" ? "contract" : "not_contract" },
    { onConflict: "user_id,vendor_key" },
  );

  if (answer === "yes" && review.transaction_id) {
    await supabase
      .from("transactions")
      .update({ category: RECURRING_CATEGORY })
      .eq("id", review.transaction_id);

    const { data: existingDebt } = await supabase
      .from("debts")
      .select("id")
      .eq("user_id", user.id)
      .eq("vendor_key", vendorKey)
      .eq("kind", "subscription")
      .maybeSingle();

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);

    if (existingDebt) {
      await supabase
        .from("debts")
        .update({
          name: review.vendor,
          total_amount: review.amount,
          monthly_amount: review.amount,
          next_due_date: nextDue.toISOString().slice(0, 10),
          source_transaction_id: review.transaction_id,
        })
        .eq("id", existingDebt.id);
    } else {
      await supabase.from("debts").insert({
        user_id: user.id,
        vendor_key: vendorKey,
        kind: "subscription",
        name: review.vendor,
        total_amount: review.amount,
        monthly_amount: review.amount,
        amount_paid: 0,
        installments_total: 1,
        installments_paid: 0,
        next_due_date: nextDue.toISOString().slice(0, 10),
        source_transaction_id: review.transaction_id,
      });
    }
  }

  const { error: updateError } = await supabase
    .from("pending_reviews")
    .update({ status: answer === "yes" ? "confirmed" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
