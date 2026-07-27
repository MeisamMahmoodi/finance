import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAppData } from "@/lib/app-data";
import { AppShell } from "@/components/app-shell";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    gmail_connected?: string;
    gmail_error?: string;
    bank_connected?: string;
    bank_error?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await loadAppData(supabase, user);

  return <AppShell data={data} initialTab="settings" settingsParams={params} />;
}
