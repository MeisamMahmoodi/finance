import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAppData } from "@/lib/app-data";
import { AppShell } from "@/components/app-shell";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const data = await loadAppData(supabase, user);

  return <AppShell data={data} initialTab="chat" settingsParams={{}} />;
}
