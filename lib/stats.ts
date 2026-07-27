import type { Transaction } from "@/lib/types";
import { RECURRING_CATEGORY } from "@/lib/categorize";

function normalizeVendor(vendor: string) {
  return vendor
    .toLowerCase()
    .replace(/[0-9]/g, "")
    .replace(/[^a-zäöüß\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Erwartete monatliche Fixkosten: pro erkanntem wiederkehrendem Empfänger den
// durchschnittlichen Betrag nehmen und aufsummieren. Robuster als "was wurde
// diesen Kalendermonat schon abgebucht", weil manche Abos erst später im
// Monat abgebucht werden.
export function computeMonthlyFixed(transactions: Transaction[]): number {
  const recurring = transactions.filter((t) => t.category === RECURRING_CATEGORY);
  const byVendor = new Map<string, number[]>();
  for (const t of recurring) {
    const key = normalizeVendor(t.vendor);
    if (!byVendor.has(key)) byVendor.set(key, []);
    byVendor.get(key)!.push(t.amount);
  }
  let total = 0;
  for (const amounts of byVendor.values()) {
    total += amounts.reduce((a, b) => a + b, 0) / amounts.length;
  }
  return total;
}

export type CategoryTotal = { category: string; total: number };

// Ausgaben nach Kategorie im aktuellen Kalendermonat, ohne die
// Wiederkehrend-Kategorie (die läuft separat als Fixkosten).
export function computeCategoryBreakdown(
  transactions: Transaction[],
  reference = new Date(),
): CategoryTotal[] {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const totals = new Map<string, number>();

  for (const t of transactions) {
    if (!t.category || t.category === RECURRING_CATEGORY) continue;
    const d = new Date(t.charged_at);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }

  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// Durchschnittliche Gesamtausgaben (alle Kategorien inkl. Fixkosten) der
// letzten 3 abgeschlossenen Kalendermonate — als einfache Prognose für den
// nächsten Monat.
export function predictNextMonthTotal(
  transactions: Transaction[],
  reference = new Date(),
): number | null {
  const monthTotals: number[] = [];
  for (let back = 1; back <= 3; back++) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - back, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const total = transactions
      .filter((t) => {
        const td = new Date(t.charged_at);
        return td.getFullYear() === year && td.getMonth() === month;
      })
      .reduce((sum, t) => sum + t.amount, 0);
    if (total > 0) monthTotals.push(total);
  }
  if (monthTotals.length === 0) return null;
  return monthTotals.reduce((a, b) => a + b, 0) / monthTotals.length;
}
