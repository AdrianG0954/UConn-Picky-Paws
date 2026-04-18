import { createClient } from "@supabase/supabase-js";
import { getAccessToken } from "../auth/session";

const supabaseUrl = import.meta.env.DEV
  ? "http://127.0.0.1:54321"
  : import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const functionsBaseUrl = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1`;

export function getFunctionUrl(functionName: string): string {
  return `${functionsBaseUrl}/${functionName}`;
}

// Sets authorization header to use jwt
async function supabaseFetch(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const accessToken = getAccessToken();
  console.log(accessToken)
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

// Sets auth for websocket used in leaderboard
export async function syncRealtimeAuth(
  accessToken: string | null = getAccessToken(),
): Promise<void> {
  await supabase.realtime.setAuth(accessToken);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  // don't want any of these options because we manage our tokens/sessions
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
  global: {
    fetch: supabaseFetch,
  },
});
