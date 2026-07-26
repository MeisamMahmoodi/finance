import type { Transaction } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

function relativeLabel(iso: string) {
  const diffDays = Math.round(
    (new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "morgen";
  if (diffDays === -1) return "gestern";
  if (diffDays > 1) return `in ${diffDays} Tagen`;
  if (diffDays < -1) return `vor ${Math.abs(diffDays)} Tagen`;
  return dateFormat.format(new Date(iso));
}

function initials(vendor: string) {
  const parts = vendor.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function Timeline({ transactions }: { transactions: Transaction[] }) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.charged_at).getTime() - new Date(b.charged_at).getTime(),
  );

  return (
    <div className="flex flex-col">
      <p className="text-xs text-secondary mb-3 px-1">Timeline</p>
      <div className="flex flex-col gap-1">
        {sorted.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 py-2.5 px-1 border-b border-border last:border-0"
          >
            <div className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-xs font-medium shrink-0">
              {initials(t.vendor)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{t.vendor}</p>
              <p className="text-muted text-xs">{relativeLabel(t.charged_at)}</p>
            </div>
            <span
              className={`text-sm shrink-0 ${
                t.status === "upcoming" ? "text-[#f2f2f2]" : "text-secondary"
              }`}
            >
              {currencyFormat.format(t.amount)}
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-muted text-sm py-6 text-center">
            Noch keine Buchungen. Verbinde E-Mail oder Bank in den
            Einstellungen.
          </p>
        )}
      </div>
    </div>
  );
}
