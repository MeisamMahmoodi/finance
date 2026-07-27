import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAspsps } from "@/lib/enable-banking";
import { BankPicker } from "@/components/bank-picker";

const BANK_ERROR_MESSAGES: Record<string, string> = {
  missing_aspsp: "Bitte eine Bank auswählen.",
  start_failed: "Verbindung zur Bank konnte nicht gestartet werden.",
};

export default async function BankConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ bank_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let banks: Awaited<ReturnType<typeof listAspsps>> = [];
  let loadError = false;
  try {
    banks = await listAspsps("DE");
  } catch (err) {
    console.error("[enable-banking] listAspsps fehlgeschlagen:", err instanceof Error ? err.message : err);
    loadError = true;
  }

  return (
    <div className="min-h-dvh px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings" aria-label="Zurück" className="w-9 h-9 rounded-full bg-surface flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">Bank verbinden</h1>
      </div>

      {params.bank_error && (
        <p className="text-danger text-xs px-1 mb-4">
          {BANK_ERROR_MESSAGES[params.bank_error] ?? "Etwas ist schiefgelaufen."}
        </p>
      )}

      {loadError ? (
        <p className="text-danger text-xs px-1">
          Bank-Liste konnte nicht geladen werden. Prüfe die Enable-Banking-Konfiguration.
        </p>
      ) : (
        <BankPicker banks={banks} />
      )}
    </div>
  );
}
