"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center mb-3">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8b8bff"
              strokeWidth="2"
            >
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.2 5.2-3-3L4 16.5" />
            </svg>
          </div>
          <h1 className="text-[15px] font-medium">Finance &amp; AI Hub</h1>
          <p className="text-muted text-xs mt-1">Alles an einem Ort</p>
        </div>

        {status === "sent" ? (
          <p className="text-sm text-secondary text-center">
            Link geschickt an <span className="text-[#f2f2f2]">{email}</span>.
            Postfach prüfen.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full h-11 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60"
            >
              {status === "sending" ? "Sende Link..." : "Login-Link senden"}
            </button>
            {status === "error" && (
              <p className="text-danger text-xs text-center">
                Da ist etwas schiefgelaufen. Nochmal versuchen.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
