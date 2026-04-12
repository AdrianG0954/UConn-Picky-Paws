import { createClient } from "jsr:@supabase/supabase-js@2";

export function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // bypasses RLS

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for Edge Functions.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
