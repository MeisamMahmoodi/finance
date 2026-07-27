"use client";

import { DebtsShell } from "@/components/debts-shell";
import type { Debt } from "@/lib/types";

export function DebtsScreen({ debts, onRefresh }: { debts: Debt[]; onRefresh: () => void }) {
  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-sm font-medium mb-6">Debts</h1>
      <DebtsShell debts={debts} onChanged={onRefresh} />
    </div>
  );
}
