import type { CategoryTotal } from "@/lib/stats";

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const monthFormat = new Intl.DateTimeFormat("de-DE", { month: "long" });

export function StatsCard({
  categoryTotals,
  prediction,
}: {
  categoryTotals: CategoryTotal[];
  prediction: number | null;
}) {
  const month = monthFormat.format(new Date());
  const max = Math.max(...categoryTotals.map((c) => c.total), 1);

  if (categoryTotals.length === 0 && prediction === null) return null;

  return (
    <div className="bg-surface rounded-card p-4 flex flex-col gap-3">
      <p className="text-xs text-secondary">Ausgaben nach Kategorie · {month}</p>

      {categoryTotals.length === 0 ? (
        <p className="text-muted text-sm">Noch keine kategorisierten Ausgaben diesen Monat.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {categoryTotals.map((c) => (
            <div key={c.category} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span>{c.category}</span>
                <span className="text-secondary">{currencyFormat.format(c.total)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max((c.total / max) * 100, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {prediction !== null && (
        <p className="text-xs text-muted border-t border-border pt-3 mt-1">
          Prognose nächster Monat (Ø letzte 3 Monate): {currencyFormat.format(prediction)}
        </p>
      )}
    </div>
  );
}
