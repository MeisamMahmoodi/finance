"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-surface flex items-center justify-center mb-3 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/login-icon.png" alt="AXIS" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-[15px] font-medium">AXIS</h1>
          <p className="text-muted text-xs mt-1">Alles an einem Ort</p>
        </div>

        <div className="flex bg-surface rounded-lg p-1 mb-4">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 h-9 rounded-md text-sm transition-colors ${
              mode === "login" ? "bg-accent text-bg font-medium" : "text-secondary"
            }`}
          >
            Anmelden
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 h-9 rounded-md text-sm transition-colors ${
              mode === "signup" ? "bg-accent text-bg font-medium" : "text-secondary"
            }`}
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-11 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 rounded-lg bg-surface border border-border px-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full h-11 rounded-lg bg-accent text-bg text-sm font-medium disabled:opacity-60"
          >
            {status === "loading"
              ? "Einen Moment..."
              : mode === "signup"
                ? "Konto erstellen"
                : "Anmelden"}
          </button>
          {status === "error" && (
            <p className="text-danger text-xs text-center">{errorMsg}</p>
          )}
        </form>
      </div>
    </div>
  );
}
