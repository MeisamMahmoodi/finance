"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisconnectButton({ url, label = "Trennen" }: { url: string; label?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDisconnect() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setLoading(true);
    try {
      await fetch(url, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  return (
    <button
      onClick={handleDisconnect}
      onBlur={() => setConfirming(false)}
      disabled={loading}
      className={`h-8 px-3 rounded-full text-xs font-medium transition-transform active:scale-95 disabled:opacity-60 ${
        confirming ? "bg-danger text-bg" : "bg-bg border border-border text-secondary"
      }`}
    >
      {loading ? "..." : confirming ? "Wirklich trennen?" : label}
    </button>
  );
}
