import { Outlet } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";

export function Layout() {
  return (
    <div className="flex min-h-svh flex-col bg-[#f4f6f8] text-zinc-900">
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-6 text-center">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-zinc-600">
          This site is made by UConn students and is no way affiliated with the
          University of Connecticut.
        </p>
      </footer>
    </div>
  );
}
