"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Box } from "@/lib/types";

const currencyFormat = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function BoxesList({ boxes }: { boxes: Box[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/boxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, target_amount: target ? Number(target) : null }),
      });
      setName("");
      setTarget("");
      setShowForm(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function adjust(id: string, delta: number) {
    await fetch(`/api/boxes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {boxes.map((box) => {
        const percent = box.target_amount ? Math.min(100, (box.saved_amount / box.target_amount) * 100) : null;
        return (
          <div key={box.id} className="bg-surface rounded-lg px-3 py-2.5 flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: box.color ?? "#8b8bff" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{box.name}</p>
              <p className="text-muted text-xs">
                {currencyFormat.format(box.saved_amount)}
                {box.target_amount ? ` / ${currencyFormat.format(box.target_amount)}` : ""}
              </p>
              {percent !== null && (
                <div className="h-1 rounded-full bg-border overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => adjust(box.id, -10)}
                className="w-7 h-7 rounded-full bg-bg text-secondary text-sm flex items-center justify-center"
              >
                −
              </button>
              <button
                onClick={() => adjust(box.id, 10)}
                className="w-7 h-7 rounded-full bg-bg text-secondary text-sm flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      {showForm ? (
        <form onSubmit={handleCreate} className="bg-surface rounded-lg p-3 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (z.B. Urlaub)"
            required
            className="h-9 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <input
            type="number"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Zielbetrag (optional)"
            className="h-9 rounded-lg bg-bg border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60"
          >
            {loading ? "..." : "Box anlegen"}
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="h-10 rounded-lg border border-dashed border-border text-secondary text-sm"
        >
          + Box hinzufügen
        </button>
      )}
    </div>
  );
}
