"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { GmailSyncButton } from "@/components/gmail-sync-button";
import { BankSyncButton } from "@/components/bank-sync-button";
import { CategorizeButton } from "@/components/categorize-button";
import { IncomeInput } from "@/components/income-input";

const GMAIL_ERROR_MESSAGES: Record<string, string> = {
  denied: "Google-Zugriff wurde abgelehnt.",
  state_mismatch: "Sicherheitsprüfung fehlgeschlagen, bitte nochmal versuchen.",
  no_refresh_token:
    "Google hat keinen dauerhaften Zugriff erteilt. Zugriff unter myaccount.google.com/permissions entfernen und erneut verbinden.",
  save_failed: "Verbindung konnte nicht gespeichert werden.",
  exchange_failed: "Verbindung mit Google fehlgeschlagen.",
};

const BANK_ERROR_MESSAGES: Record<string, string> = {
  denied: "Bank-Zugriff wurde abgelehnt.",
  state_mismatch: "Sicherheitsprüfung fehlgeschlagen, bitte nochmal versuchen.",
  save_failed: "Verbindung konnte nicht gespeichert werden.",
  exchange_failed: "Verbindung mit der Bank fehlgeschlagen.",
};

type SettingsParams = {
  gmail_connected?: string;
  gmail_error?: string;
  bank_connected?: string;
  bank_error?: string;
};

export function SettingsScreen({
  userEmail,
  gmailConnection,
  bankConnection,
  monthlyIncome,
  hasIncomeSet,
  searchParams,
}: {
  userEmail: string;
  gmailConnection: { email_address: string | null; status: string | null; last_synced_at: string | null } | null;
  bankConnection: { aspsp_name: string | null; status: string | null; last_synced_at: string | null } | null;
  monthlyIncome: number;
  hasIncomeSet: boolean;
  searchParams: SettingsParams;
}) {
  const hasAnyConnection = gmailConnection?.status === "connected" || bankConnection?.status === "connected";

  return (
    <div className="px-4 pt-4 pb-28">
      <h1 className="text-sm font-medium mb-6">Einstellungen</h1>

      <p className="text-xs text-secondary mb-2 px-1">Konto</p>
      <p className="text-sm bg-surface rounded-card px-3 py-2.5 mb-6 text-secondary">{userEmail}</p>

      <p className="text-xs text-secondary mb-2 px-1">Verknüpfungen</p>
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5">
          <span className="text-sm flex-1">{gmailConnection?.email_address ?? "Gmail-Postfach"}</span>
          <span className={`text-xs ${gmailConnection?.status === "connected" ? "text-success" : "text-muted"}`}>
            {gmailConnection?.status === "connected" ? "verbunden" : "nicht verbunden"}
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
            className="w-full h-10 rounded-lg bg-accent text-bg text-sm font-medium flex items-center justify-center transition-transform active:scale-[0.98]"
          >
            Gmail verbinden
          </a>
        )}

        {searchParams.gmail_error && (
          <p className="text-danger text-xs px-1">
            {GMAIL_ERROR_MESSAGES[searchParams.gmail_error] ?? "Etwas ist schiefgelaufen."}
          </p>
        )}
        {searchParams.gmail_connected && <p className="text-success text-xs px-1">Gmail verbunden.</p>}

        <div className="flex items-center gap-3 bg-surface rounded-lg px-3 py-2.5">
          <span className="text-sm flex-1">{bankConnection?.aspsp_name ?? "Bankkonto"}</span>
          <span className={`text-xs ${bankConnection?.status === "connected" ? "text-success" : "text-muted"}`}>
            {bankConnection?.status === "connected" ? "verbunden" : "nicht verbunden"}
          </span>
        </div>

        {bankConnection?.status === "connected" ? (
          <>
            <p className="text-muted text-xs px-1">
              {bankConnection.last_synced_at
                ? `Zuletzt synchronisiert: ${new Date(bankConnection.last_synced_at).toLocaleString("de-DE")}`
                : "Noch nicht synchronisiert"}
            </p>
            <BankSyncButton />
          </>
        ) : (
          <Link
            href="/bank/connect"
            className="w-full h-10 rounded-lg bg-accent text-bg text-sm font-medium flex items-center justify-center transition-transform active:scale-[0.98]"
          >
            Bank verbinden
          </Link>
        )}

        {searchParams.bank_error && (
          <p className="text-danger text-xs px-1">
            {BANK_ERROR_MESSAGES[searchParams.bank_error] ?? "Etwas ist schiefgelaufen."}
          </p>
        )}
        {searchParams.bank_connected && <p className="text-success text-xs px-1">Bank verbunden.</p>}

        {hasAnyConnection && (
          <>
            <p className="text-muted text-xs px-1 mt-1">
              Kategorisiert Buchungen nach Essen/Transport/Spaß/etc., erkennt Abos automatisch und sortiert sie unter Debts ein.
            </p>
            <CategorizeButton />
          </>
        )}
      </div>

      <p className="text-xs text-secondary mb-2 px-1">Einnahmen</p>
      <div className="mb-8">
        <p className="text-muted text-xs px-1 mb-2">
          Monatliches Netto-Einkommen (für die Verfügbar-Anzeige — Banken liefern uns nur Ausgaben, keine Gehaltsbuchungen).
        </p>
        <IncomeInput initialValue={monthlyIncome ?? 0} />
      </div>

      <p className="text-xs text-secondary mb-2 px-1">Benachrichtigungen</p>
      <div className="flex items-center justify-between bg-surface rounded-lg px-3 py-2.5 mb-8">
        <span className="text-sm">Push-Benachrichtigungen</span>
        <span className="text-xs text-muted">kommt in Phase 4</span>
      </div>

      <LogoutButton />
    </div>
  );
}
