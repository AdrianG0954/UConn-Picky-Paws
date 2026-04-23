import { useLayoutEffect } from "react";
import { Outlet } from "react-router-dom";
import { isSessionAuthenticated } from "../auth/session";
import { API_BASE_URL } from "../api";

/*
 * Full-page redirect to backend `GET /login` → UConn CAS.
 * (Client-side routing alone cannot start the CAS handshake.)
 */
export function RequireAuth() {
  const authed = isSessionAuthenticated();

  useLayoutEffect(() => {
    // redirect to login page if not authenticated
    if (!authed) window.location.replace(`${API_BASE_URL}/login`);
  }, [authed]);

  if (!authed) {
    return (
      <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-zinc-600">
        <p>Signing in with UConn SSO...</p>
        <p className="text-xs text-zinc-500">
          If this takes too long, refresh the page or check your connection.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
