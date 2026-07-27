"use client";

import { useMemo, useState } from "react";
import type { Aspsp } from "@/lib/enable-banking";

export function BankPicker({ banks }: { banks: Aspsp[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, query]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Bank suchen..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full h-11 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent"
      />
      <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {filtered.map((bank) => (
          <a
            key={`${bank.name}-${bank.country}`}
            href={`/api/bank/connect?aspsp_name=${encodeURIComponent(bank.name)}&aspsp_country=${encodeURIComponent(bank.country)}`}
            className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5 text-sm hover:border-accent border border-transparent"
          >
            {bank.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bank.logo} alt="" className="w-6 h-6 rounded object-contain" />
            )}
            <span className="flex-1">{bank.name}</span>
          </a>
        ))}
        {filtered.length === 0 && (
          <p className="text-muted text-xs text-center py-6">Keine Bank gefunden.</p>
        )}
      </div>
    </div>
  );
}
