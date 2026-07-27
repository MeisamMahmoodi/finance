"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IncomeInput({ initialValue }: { initialValue: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialValue || ""));
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function handleSave() {
    setStatus("loading");
    try {
      const res = await fetch("/api/settings/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_income: Number(value) }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("done");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="z.B. 3200"
          className="flex-1 h-10 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={handleSave}
          disabled={status === "loading"}
          className="px-4 h-10 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60"
        >
          {status === "loading" ? "..." : "Speichern"}
        </button>
      </div>
      {status === "done" && <p className="text-success text-xs px-1">Gespeichert.</p>}
      {status === "error" && <p className="text-danger text-xs px-1">Fehler beim Speichern.</p>}
    </div>
  );
}
