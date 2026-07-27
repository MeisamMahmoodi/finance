import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  const { data: debt, error: fetchError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !debt) {
    return NextResponse.json({ error: "Debt nicht gefunden" }, { status: 404 });
  }

  if (debt.installments_paid >= debt.installments_total) {
    return NextResponse.json({ ok: true, already_done: true });
  }

  const installmentAmount = debt.total_amount / debt.installments_total;
  const newInstallmentsPaid = debt.installments_paid + 1;
  const newAmountPaid = Math.min(
    debt.total_amount,
    newInstallmentsPaid >= debt.installments_total ? debt.total_amount : debt.amount_paid + installmentAmount,
  );

  let newDueDate: string | null = debt.next_due_date;
  if (newInstallmentsPaid >= debt.installments_total) {
    newDueDate = null;
  } else if (debt.next_due_date) {
    const d = new Date(debt.next_due_date);
    d.setMonth(d.getMonth() + 1);
    newDueDate = d.toISOString().slice(0, 10);
  }

  const { error: updateError } = await supabase
    .from("debts")
    .update({
      installments_paid: newInstallmentsPaid,
      amount_paid: newAmountPaid,
      next_due_date: newDueDate,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
