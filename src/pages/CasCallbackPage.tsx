import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchCasCallback } from "../api";
import { setAccessToken } from "../auth/session";
import { syncRealtimeAuth } from "../utils/supabase";

/** CAS sends the browser here with `?ticket=`; we pass it to the backend once—no client-side CAS validation. */
export function CasCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ticket = searchParams.get("ticket")?.trim();

    async function run() {
      if (!ticket) {
        if (!cancelled)
          setError("Missing sign-in ticket. Try signing in again.");
        return;
      }
      const cas = await fetchCasCallback(ticket);
      if (cancelled) return;
      setAccessToken(cas.accessToken);
      await syncRealtimeAuth(cas.accessToken);
      navigate("/rank", { replace: true });
    }

    void run().catch((error) => {
      if (cancelled) return;
      setError(
        error instanceof Error && error.message
          ? error.message
          : "SSO sign in failed. Please try again.",
      );
    });
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-[#f4f6f8] px-6 text-center">
        <p className="max-w-md text-sm text-zinc-700">{error}</p>
        <Link
          to="/"
          className="mt-6 rounded-lg bg-uconn-navy px-5 py-2.5 text-sm font-medium text-white hover:opacity-95"
        >
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-[#f4f6f8] px-4 text-center text-sm text-zinc-600">
      <p>Completing sign-in…</p>
    </div>
  );
}
