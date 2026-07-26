import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { demoConnections } from "@/lib/demo-data";
import { LogoutButton } from "@/components/logout-button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: connData } = await supabase
    .from("connections")
    .select("*")
    .order("created_at", { ascending: true });

  const connections =
    connData && connData.length > 0 ? connData : demoConnections;

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
      <div className="flex flex-col gap-2 mb-6">
        {connections.map((c) => (
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

      <p className="text-xs text-secondary mb-2 px-1">Benachrichtigungen</p>
      <div className="flex items-center justify-between bg-surface rounded-lg px-3 py-2.5 mb-8">
        <span className="text-sm">Push-Benachrichtigungen</span>
        <span className="text-xs text-muted">kommt in Phase 4</span>
      </div>

      <LogoutButton />
    </div>
  );
}
