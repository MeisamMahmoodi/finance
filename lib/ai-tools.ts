import { SchemaType, type FunctionDeclaration, type Tool } from "@google/generative-ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePendingReview } from "@/lib/reviews";

// Werkzeuge, die der KI-Chat per Function-Calling nutzen kann, um wirklich
// auf die Daten des Nutzers zuzugreifen (nicht nur darüber zu reden): lesen,
// sortieren/anlegen, prüfen und auf Wunsch bearbeiten - Transaktionen, Debts
// (Kredite/Abos/Rechnungen) und offene Rückfragen. Jede Funktion arbeitet
// ausschließlich über den eingeloggten Supabase-Client des Nutzers (RLS
// sorgt dafür, dass nie Daten eines anderen Nutzers berührt werden können).

const listTransactions: FunctionDeclaration = {
  name: "list_transactions",
  description:
    "Listet Transaktionen des Nutzers auf, optional gefiltert nach Kategorie, Empfänger (Teilstring) oder Richtung (Einnahme/Ausgabe). Nützlich um Fragen wie 'wie viel habe ich bei X ausgegeben' zu beantworten oder eine Transaktion zum Bearbeiten zu finden.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      category: { type: SchemaType.STRING, description: "Exakte Kategorie, z.B. 'Essen', 'Wiederkehrend'" },
      vendor_contains: { type: SchemaType.STRING, description: "Teilstring des Empfänger-/Vendornamens" },
      direction: { type: SchemaType.STRING, format: "enum", enum: ["in", "out"], description: "'in' = Einnahme, 'out' = Ausgabe" },
      limit: { type: SchemaType.NUMBER, description: "Max. Anzahl Ergebnisse, Standard 20" },
    },
  },
};

const createTransaction: FunctionDeclaration = {
  name: "create_transaction",
  description: "Legt eine neue Transaktion manuell an (z.B. wenn der Nutzer eine Ausgabe/Einnahme nennt, die noch nicht erfasst ist).",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      vendor: { type: SchemaType.STRING, description: "Empfänger/Bezeichnung" },
      amount: { type: SchemaType.NUMBER, description: "Betrag als positive Zahl" },
      direction: { type: SchemaType.STRING, format: "enum", enum: ["in", "out"] },
      category: { type: SchemaType.STRING, description: "Kategorie, optional" },
      charged_at: { type: SchemaType.STRING, description: "Datum YYYY-MM-DD, Standard heute" },
    },
    required: ["vendor", "amount", "direction"],
  },
};

const updateTransaction: FunctionDeclaration = {
  name: "update_transaction",
  description: "Ändert eine bestehende Transaktion (Empfänger, Betrag, Kategorie oder Datum). Nur übergebene Felder werden geändert.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      transaction_id: { type: SchemaType.STRING },
      vendor: { type: SchemaType.STRING },
      amount: { type: SchemaType.NUMBER },
      category: { type: SchemaType.STRING },
      charged_at: { type: SchemaType.STRING, description: "Datum YYYY-MM-DD" },
    },
    required: ["transaction_id"],
  },
};

const deleteTransaction: FunctionDeclaration = {
  name: "delete_transaction",
  description: "Löscht eine Transaktion unwiderruflich.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { transaction_id: { type: SchemaType.STRING } },
    required: ["transaction_id"],
  },
};

const listDebts: FunctionDeclaration = {
  name: "list_debts",
  description: "Listet Debts (Kredite/Raten, KI-erkannte Abos, oder Rechnungen) des Nutzers auf, optional gefiltert nach Art.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      kind: { type: SchemaType.STRING, format: "enum", enum: ["loan", "subscription", "invoice"] },
    },
  },
};

const createInvoice: FunctionDeclaration = {
  name: "create_invoice",
  description: "Legt eine neue Rechnung/Bill unter Debts an, mit freier Kategorie (Tag) und optionalem Fälligkeitsdatum.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING, description: "Bezeichnung, z.B. 'Zahnarzt', 'Werkstatt'" },
      amount: { type: SchemaType.NUMBER },
      tag: { type: SchemaType.STRING, description: "Freie Kategorie, z.B. 'Auto', 'Gesundheit'" },
      next_due_date: { type: SchemaType.STRING, description: "Fälligkeitsdatum YYYY-MM-DD, optional" },
    },
    required: ["name", "amount"],
  },
};

const updateDebt: FunctionDeclaration = {
  name: "update_debt",
  description: "Ändert einen bestehenden Debt-Eintrag (Kredit, Abo oder Rechnung): Name, Betrag, Tag, Fälligkeitsdatum oder Anzahl Raten.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      debt_id: { type: SchemaType.STRING },
      name: { type: SchemaType.STRING },
      total_amount: { type: SchemaType.NUMBER },
      tag: { type: SchemaType.STRING },
      next_due_date: { type: SchemaType.STRING, description: "Datum YYYY-MM-DD" },
      installments_total: { type: SchemaType.NUMBER },
    },
    required: ["debt_id"],
  },
};

const markDebtPaid: FunctionDeclaration = {
  name: "mark_debt_paid",
  description: "Markiert einen Debt-Eintrag (Rechnung oder Kredit-Rate) als bezahlt.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { debt_id: { type: SchemaType.STRING } },
    required: ["debt_id"],
  },
};

const deleteDebt: FunctionDeclaration = {
  name: "delete_debt",
  description: "Löscht einen Debt-Eintrag (Kredit, Abo oder Rechnung) unwiderruflich.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: { debt_id: { type: SchemaType.STRING } },
    required: ["debt_id"],
  },
};

const listPendingReviews: FunctionDeclaration = {
  name: "list_pending_reviews",
  description: "Listet offene Rückfragen der KI auf (z.B. 'ist X ein Vertrag?'), die der Nutzer noch nicht beantwortet hat.",
  parameters: { type: SchemaType.OBJECT, properties: {} },
};

const resolvePendingReviewDecl: FunctionDeclaration = {
  name: "resolve_pending_review",
  description:
    "Beantwortet eine offene Rückfrage der KI ('ist X ein Vertrag/Abo?') direkt im Chat, wenn der Nutzer die Antwort als Text tippt statt die Ja/Nein-Buttons zu nutzen. Merkt sich die Entscheidung dauerhaft für diesen Empfänger.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      review_id: { type: SchemaType.STRING },
      answer: { type: SchemaType.STRING, format: "enum", enum: ["yes", "no"] },
    },
    required: ["review_id", "answer"],
  },
};

export const AI_TOOLS: Tool[] = [
  {
    functionDeclarations: [
      listTransactions,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      listDebts,
      createInvoice,
      updateDebt,
      markDebtPaid,
      deleteDebt,
      listPendingReviews,
      resolvePendingReviewDecl,
    ],
  },
];

type ToolArgs = Record<string, unknown>;

function str(args: ToolArgs, key: string): string | undefined {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(args: ToolArgs, key: string): number | undefined {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// Führt einen von Gemini angeforderten Funktionsaufruf aus und gibt ein
// JSON-serialisierbares Ergebnis zurück, das als functionResponse an das
// Modell zurückgeschickt wird.
export async function executeAiTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  args: ToolArgs,
): Promise<object> {
  switch (name) {
    case "list_transactions": {
      let query = supabase.from("transactions").select("*").eq("user_id", userId);
      const category = str(args, "category");
      const vendorContains = str(args, "vendor_contains");
      const direction = str(args, "direction");
      if (category) query = query.eq("category", category);
      if (vendorContains) query = query.ilike("vendor", `%${vendorContains}%`);
      if (direction === "in" || direction === "out") query = query.eq("direction", direction);
      const limit = num(args, "limit") ?? 20;
      const { data, error } = await query.order("charged_at", { ascending: false }).limit(Math.min(limit, 100));
      if (error) return { error: error.message };
      return { transactions: data ?? [] };
    }

    case "create_transaction": {
      const vendor = str(args, "vendor");
      const amount = num(args, "amount");
      const direction = str(args, "direction");
      if (!vendor || amount === undefined || (direction !== "in" && direction !== "out")) {
        return { error: "vendor, amount und direction ('in'/'out') sind erforderlich" };
      }
      const { data, error } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          vendor,
          amount: Math.abs(amount),
          direction,
          category: str(args, "category") ?? null,
          charged_at: str(args, "charged_at") ?? new Date().toISOString().slice(0, 10),
          currency: "EUR",
          source: "manual",
          status: "completed",
        })
        .select()
        .single();
      if (error) return { error: error.message };
      return { created: data };
    }

    case "update_transaction": {
      const id = str(args, "transaction_id");
      if (!id) return { error: "transaction_id fehlt" };
      const updates: Record<string, unknown> = {};
      const vendor = str(args, "vendor");
      const amount = num(args, "amount");
      const category = str(args, "category");
      const chargedAt = str(args, "charged_at");
      if (vendor) updates.vendor = vendor;
      if (amount !== undefined) updates.amount = Math.abs(amount);
      if (category) updates.category = category;
      if (chargedAt) updates.charged_at = chargedAt;
      if (Object.keys(updates).length === 0) return { error: "Keine Änderungen übergeben" };
      const { data, error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Transaktion nicht gefunden" };
      return { updated: data };
    }

    case "delete_transaction": {
      const id = str(args, "transaction_id");
      if (!id) return { error: "transaction_id fehlt" };
      const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true };
    }

    case "list_debts": {
      let query = supabase.from("debts").select("*").eq("user_id", userId);
      const kind = str(args, "kind");
      if (kind === "loan" || kind === "subscription" || kind === "invoice") query = query.eq("kind", kind);
      const { data, error } = await query.order("next_due_date", { ascending: true });
      if (error) return { error: error.message };
      return { debts: data ?? [] };
    }

    case "create_invoice": {
      const name = str(args, "name");
      const amount = num(args, "amount");
      if (!name || amount === undefined) return { error: "name und amount sind erforderlich" };
      const { data, error } = await supabase
        .from("debts")
        .insert({
          user_id: userId,
          kind: "invoice",
          name,
          total_amount: Math.abs(amount),
          amount_paid: 0,
          installments_total: 1,
          installments_paid: 0,
          tag: str(args, "tag") ?? null,
          next_due_date: str(args, "next_due_date") ?? null,
        })
        .select()
        .single();
      if (error) return { error: error.message };
      return { created: data };
    }

    case "update_debt": {
      const id = str(args, "debt_id");
      if (!id) return { error: "debt_id fehlt" };
      const updates: Record<string, unknown> = {};
      const name = str(args, "name");
      const totalAmount = num(args, "total_amount");
      const tag = str(args, "tag");
      const nextDueDate = str(args, "next_due_date");
      const installmentsTotal = num(args, "installments_total");
      if (name) updates.name = name;
      if (totalAmount !== undefined) updates.total_amount = totalAmount;
      if (tag) updates.tag = tag;
      if (nextDueDate) updates.next_due_date = nextDueDate;
      if (installmentsTotal !== undefined) updates.installments_total = Math.max(1, Math.round(installmentsTotal));
      if (Object.keys(updates).length === 0) return { error: "Keine Änderungen übergeben" };
      const { data, error } = await supabase
        .from("debts")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "Debt nicht gefunden" };
      return { updated: data };
    }

    case "mark_debt_paid": {
      const id = str(args, "debt_id");
      if (!id) return { error: "debt_id fehlt" };
      const { data: debt, error: fetchError } = await supabase
        .from("debts")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (fetchError || !debt) return { error: "Debt nicht gefunden" };
      if (debt.kind === "invoice") {
        const { data, error } = await supabase
          .from("debts")
          .update({ amount_paid: debt.total_amount, installments_paid: 1 })
          .eq("id", id)
          .select()
          .single();
        if (error) return { error: error.message };
        return { updated: data };
      }
      const installmentAmount = debt.total_amount / Math.max(debt.installments_total, 1);
      const { data, error } = await supabase
        .from("debts")
        .update({
          amount_paid: Math.min(debt.amount_paid + installmentAmount, debt.total_amount),
          installments_paid: Math.min(debt.installments_paid + 1, debt.installments_total),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return { error: error.message };
      return { updated: data };
    }

    case "delete_debt": {
      const id = str(args, "debt_id");
      if (!id) return { error: "debt_id fehlt" };
      const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true };
    }

    case "list_pending_reviews": {
      const { data, error } = await supabase
        .from("pending_reviews")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) return { error: error.message };
      return { pending_reviews: data ?? [] };
    }

    case "resolve_pending_review": {
      const reviewId = str(args, "review_id");
      const answer = str(args, "answer");
      if (!reviewId || (answer !== "yes" && answer !== "no")) {
        return { error: "review_id und answer ('yes'/'no') sind erforderlich" };
      }
      try {
        return await resolvePendingReview(supabase, userId, reviewId, answer);
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Fehler" };
      }
    }

    default:
      return { error: `Unbekanntes Tool: ${name}` };
  }
}
