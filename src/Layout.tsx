import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SiteHeader } from "./components/SiteHeader";
import pawWatermark from "./assets/paw.png";

function PageFallback() {
  return (
    <div className="flex min-h-[30vh] flex-1 items-center justify-center text-sm text-zinc-500">
      Loading…
    </div>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const showPawBackdrop = pathname === "/rank" || pathname === "/leaderboard";

  return (
    <div className="flex min-h-svh flex-col bg-[#f4f6f8] text-zinc-900">
      <SiteHeader />
      <main className="relative flex min-h-0 flex-1 flex-col">
        {showPawBackdrop ? (
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden
          >
            <img
              src={pawWatermark}
              alt=""
              decoding="async"
              draggable={false}
              className="absolute -left-4 top-0 w-[min(78vw,22rem)] max-w-none -translate-y-[8%] rotate-[24deg] opacity-[0.07] select-none sm:-left-6 sm:top-2 sm:w-[min(62vw,26rem)] sm:translate-y-0 sm:rotate-[20deg] sm:opacity-[0.09] md:w-[min(52vw,30rem)]"
            />
            <img
              src={pawWatermark}
              alt=""
              decoding="async"
              draggable={false}
              className="absolute -right-4 bottom-0 w-[min(78vw,22rem)] max-w-none translate-y-[12%] rotate-[-26deg] opacity-[0.07] select-none sm:-right-6 sm:bottom-2 sm:w-[min(62vw,26rem)] sm:translate-y-0 sm:rotate-[-22deg] sm:opacity-[0.09] md:w-[min(52vw,30rem)]"
            />
          </div>
        ) : null}
        <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-6 text-center">
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-zinc-600">
          This site is made by UConn students and is in no way affiliated with
          the University.
        </p>
        <p className="mx-auto max-w-3xl text-sm leading-relaxed text-zinc-600">
          All data is sourced from the University's dining services website.
        </p>
      </footer>
    </div>
  );
}
