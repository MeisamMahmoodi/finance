"use client";

import { useState } from "react";
import type { Transaction } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "short",
});

const CATEGORY_COLORS: Record<string, string> = {
  Wiederkehrend: "#8b8bff",
  Essen: "#f2c94c",
  Transport: "#56ccf2",
  Arbeit: "#bb86fc",
  Spaß: "#ff8fab",
  Wohnen: "#5dcaa5",
  Shopping: "#f2994a",
  Gesundheit: "#e2504a",
  Sonstiges: "#6b6b70",
};

function categoryColor(category: string | null) {
  return category ? (CATEGORY_COLORS[category] ?? "#6b6b70") : "#6b6b70";
}

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

const DEFAULT_VISIBLE = 6;

export function Timeline({
  transactions,
  showHeading = true,
}: {
  transactions: Transaction[];
  showHeading?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.charged_at).getTime() - new Date(a.charged_at).getTime(),
  );
  const visible = expanded ? sorted : sorted.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="flex flex-col">
      {showHeading && <p className="text-xs text-secondary mb-3 px-1">Transactions</p>}
      <div className="flex flex-col gap-1">
        {visible.map((t) => {
          const color = categoryColor(t.category);
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 py-2.5 px-1 border-b border-border last:border-0"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                style={{ backgroundColor: `${color}26`, color }}
              >
                {initials(t.vendor)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{t.vendor}</p>
                <p className="text-muted text-xs">
                  {relativeLabel(t.charged_at)}
                  {t.category && ` · ${t.category}`}
                </p>
              </div>
              <span
                className={`text-sm shrink-0 ${
                  t.status === "upcoming" ? "text-ink" : "text-secondary"
                }`}
              >
                {t.direction === "in" ? "+" : "−"}
                {currencyFormat.format(t.amount)}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-muted text-sm py-6 text-center">
            Noch keine Buchungen. Verbinde E-Mail oder Bank in den
            Einstellungen.
          </p>
        )}
      </div>
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 h-9 rounded-full border border-border text-secondary text-xs transition-transform active:scale-[0.98]"
        >
          {hiddenCount} weitere anzeigen
        </button>
      )}
      {expanded && sorted.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2 h-9 rounded-full text-muted text-xs transition-transform active:scale-[0.98]"
        >
          Weniger anzeigen
        </button>
      )}
    </div>
  );
}
