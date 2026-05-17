import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/config";

export function createSupabaseAdmin() {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
