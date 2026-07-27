import type { SupabaseClient } from "@supabase/supabase-js";
import { RECURRING_CATEGORY, normalizeVendor } from "@/lib/categorize";

// Gemeinsame Logik zum Beantworten einer "ist das ein Vertrag?"-Rückfrage -
// genutzt sowohl von der Chat-Karte (Ja/Nein-Buttons) als auch vom KI-Tool
// im Chat (wenn der Nutzer die Antwort einfach als Text tippt).
export async function resolvePendingReview(
  supabase: SupabaseClient,
  userId: string,
  reviewId: string,
  answer: "yes" | "no",
) {
  const { data: review, error: fetchError } = await supabase
    .from("pending_reviews")
    .select("*")
    .eq("id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || !review) {
    throw new Error("Rückfrage nicht gefunden");
  }

  const vendorKey = normalizeVendor(review.vendor);

  await supabase.from("vendor_rules").upsert(
    { user_id: userId, vendor_key: vendorKey, decision: answer === "yes" ? "contract" : "not_contract" },
    { onConflict: "user_id,vendor_key" },
  );

  if (answer === "yes" && review.transaction_id) {
    await supabase.from("transactions").update({ category: RECURRING_CATEGORY }).eq("id", review.transaction_id);

    const { data: existingDebt } = await supabase
      .from("debts")
      .select("id")
      .eq("user_id", userId)
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
        user_id: userId,
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

  await supabase
    .from("pending_reviews")
    .update({ status: answer === "yes" ? "confirmed" : "rejected", resolved_at: new Date().toISOString() })
    .eq("id", reviewId);

  return { ok: true };
}
