import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoConnections } from "@/lib/demo-data";
import { LogoutButton } from "@/components/logout-button";
import { GmailSyncButton } from "@/components/gmail-sync-button";

const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  denied: "Google-Zugriff wurde abgelehnt.",
  state_mismatch: "Sicherheitsprüfung fehlgeschlagen, bitte nochmal versuchen.",
  no_refresh_token:
    "Google hat keinen dauerhaften Zugriff erteilt. Zugriff unter myaccount.google.com/permissions entfernen und erneut verbinden.",
  save_failed: "Verbindung konnte nicht gespeichert werden.",
  exchange_failed: "Verbindung mit Google fehlgeschlagen.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: gmailConnection } = await supabase
    .from("email_connections")
    .select("email_address, status, last_synced_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: connData } = await supabase
    .from("connections")
    .select("*")
    .order("created_at", { ascending: true });

  const bankConnections =
    connData && connData.length > 0
      ? connData
      : demoConnections.filter((c) => c.type === "bank");

  return (
    <div className="min-h-dvh max-w-md mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" aria-label="Zurück" className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e6e6e6" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">Einstellungen</h1>
      </div>

      <p className="text-xs text-secondary mb-2 px-1">Konto</p>
      <p className="text-sm bg-surface rounded-card px-3 py-2.5 mb-6 text-secondary">
        {user.email}
      </p>

      <p className="text-xs text-secondary mb-2 px-1">Verknüpfungen</p>
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5">
          <span className="text-sm flex-1">
            {gmailConnection?.email_address ?? "Gmail-Postfach"}
          </span>
          <span
            className={`text-xs ${
              gmailConnection?.status === "connected"
                ? "text-success"
                : "text-muted"
            }`}
          >
            {gmailConnection?.status === "connected"
              ? "verbunden"
              : "nicht verbunden"}
          </span>
        </div>

        {gmailConnection?.status === "connected" ? (
          <>
            <p className="text-muted text-xs px-1">
              {gmailConnection.last_synced_at
                ? `Zuletzt synchronisiert: ${new Date(gmailConnection.last_synced_at).toLocaleString("de-DE")}`
                : "Noch nicht synchronisiert"}
            </p>
            <GmailSyncButton />
          </>
        ) : (
          <a
            href="/api/auth/google"
            className="w-full h-10 rounded-lg bg-accent text-bg text-sm font-medium flex items-center justify-center"
          >
            Gmail verbinden
          </a>
        )}

        {params.gmail_error && (
          <p className="text-danger text-xs px-1">
            {GMAIL_ERROR_MESSAGES[params.gmail_error] ?? "Etwas ist schiefgelaufen."}
          </p>
        )}
        {params.gmail_connected && (
          <p className="text-success text-xs px-1">Gmail verbunden.</p>
        )}

        {bankConnections.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5"
          >
            <span className="text-sm flex-1">{c.label}</span>
            <span
              className={`text-xs ${
                c.status === "connected" ? "text-success" : "text-muted"
              }`}
            >
              {c.status === "connected" ? "verbunden" : "nicht verbunden"}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-secondary mb-2 mt-6 px-1">Benachrichtigungen</p>
      <div className="flex items-center justify-between bg-surface rounded-lg px-3 py-2.5 mb-8">
        <span className="text-sm">Push-Benachrichtigungen</span>
        <span className="text-xs text-muted">kommt in Phase 4</span>
      </div>

      <LogoutButton />
    </div>
  );
}
