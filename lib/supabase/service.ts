import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/supabase/config";

// Nur server-seitig verwenden (Cron/Sync-Jobs) — umgeht RLS komplett.
// SUPABASE_SERVICE_ROLE_KEY steht nur als Env-Var auf dem Server, nie im Client-Bundle.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt");
  }
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
