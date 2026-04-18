import { getCasLoginUrl } from "../api";
import { isSessionAuthenticated } from "../auth/session";
import { Navigate } from "react-router-dom";

export function SignInPage() {
  if (isSessionAuthenticated()) {
    return <Navigate to="/rank" replace />;
  }

  return (
    <div className="flex min-h-[calc(100svh-10rem)] flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-uconn-navy/70">
          Picky Paws
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Sign in with UConn CAS
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Use your UConn NetID to securely access rankings, leaderboard data,
          and live updates.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.assign(getCasLoginUrl());
          }}
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-uconn-navy px-5 py-3 text-sm font-semibold text-white transition hover:opacity-95"
        >
          Continue to UConn Login
        </button>
      </div>
    </div>
  );
}
