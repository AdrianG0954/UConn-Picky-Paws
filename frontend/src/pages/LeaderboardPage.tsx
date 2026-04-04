import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fetchDiningHalls } from "../api";
import { useLeaderboardSocket } from "../hooks/useLeaderboardSocket";
import { formatEloForDisplay } from "../lib/eloDisplay";
import type {
  DiningHallTab,
  LeaderboardTab,
  ConnectionState,
  GlobalTab,
  DiningHallOption,
} from "../types/leaderboard";

const GLOBAL_TAB: GlobalTab = {
  key: "global",
  label: "Global",
  scope: "global",
};

function tabFromDiningHall(option: DiningHallOption): DiningHallTab {
  return {
    key: option.id,
    label: option.name,
    scope: "dining_hall",
    diningHallId: option.id,
  };
}

function connectionLabel(state: ConnectionState): string {
  if (state === "connected") return "Live";
  if (state === "reconnecting") return "Reconnecting...";
  return "Connecting...";
}

function connectionDotClass(state: ConnectionState): string {
  if (state === "connected") {
    return "bg-green-600 shadow-[0_0_0_1px_rgb(34_197_94_/_0.14),0_0_10px_rgb(34_197_94_/_0.35)]";
  }

  return "bg-red-600 shadow-[0_0_0_1px_rgb(248_113_113_/_0.14),0_0_10px_rgb(248_113_113_/_0.32)]";
}

export function LeaderboardPage() {
  const [tabs, setTabs] = useState<LeaderboardTab[]>([GLOBAL_TAB]);
  const [selectedTabKey, setSelectedTabKey] = useState<string>(GLOBAL_TAB.key);
  const [tabError, setTabError] = useState<string | null>(null);

  const selectedTab =
    tabs.find((tab) => tab.key === selectedTabKey) ?? GLOBAL_TAB;
  const { connectionState, entries, loading, socketError } =
    useLeaderboardSocket(selectedTab);

  function handleTabSelection(tab: LeaderboardTab) {
    if (tab.key === selectedTabKey) return;
    setSelectedTabKey(tab.key);
  }

  useEffect(() => {
    let active = true;

    async function loadDiningHallTabs() {
      try {
        const halls = await fetchDiningHalls();
        if (!active) return;
        setTabs([GLOBAL_TAB, ...halls.map(tabFromDiningHall)]);
        setTabError(null);
      } catch (error) {
        if (!active) return;
        setTabs([GLOBAL_TAB]);
        setTabError(
          error instanceof Error
            ? error.message
            : "Unable to load dining hall tabs.",
        );
      }
    }

    void loadDiningHallTabs();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-uconn-navy md:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-2 text-zinc-600">
            Live top dishes across UConn dining halls.
          </p>
        </div>
        <p
          className="inline-flex items-center gap-[0.55rem] text-sm font-medium text-zinc-500"
          aria-live="polite"
        >
          <motion.span
            aria-hidden="true"
            className={[
              "h-[0.55rem] w-[0.55rem] shrink-0 rounded-full",
              connectionDotClass(connectionState),
            ].join(" ")}
            animate={{ scale: [1, 1.14, 1], opacity: [0.92, 1, 0.92] }}
            transition={{
              duration: 2.4,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
            }}
          />
          {connectionLabel(connectionState)}
        </p>
      </header>

      {tabError ? (
        <div
          className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {tabError}
        </div>
      ) : null}

      {socketError ? (
        <div
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {socketError}
        </div>
      ) : null}

      <div className="mb-6 overflow-x-auto">
        <div
          className="inline-flex min-w-full gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
          role="tablist"
          aria-label="Leaderboard tabs"
        >
          {tabs.map((tab) => {
            const isActive = tab.key === selectedTabKey;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabSelection(tab)}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-uconn-navy text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-uconn-navy",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <section
        className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
        aria-label="Leaderboard table"
      >
        <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto] gap-4 border-b border-zinc-200 bg-zinc-50 px-5 py-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          <span>Name</span>
          <span>Dining Hall</span>
          <span className="text-right">Elo</span>
        </div>

        {loading ? (
          <p className="px-5 py-8 text-sm text-zinc-500">
            Loading leaderboard...
          </p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-zinc-500">
            No dishes are available for this leaderboard yet.
          </p>
        ) : (
          <div>
            <AnimatePresence initial={false} mode="popLayout">
              {entries.map((entry) => (
                <motion.div
                  layout="position"
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{
                    layout: {
                      type: "spring",
                      stiffness: 340,
                      damping: 32,
                      mass: 0.9,
                    },
                    opacity: { duration: 0.18, ease: "easeOut" },
                    scale: { duration: 0.18, ease: "easeOut" },
                  }}
                  key={`${entry.dining_hall_id}:${entry.name}`}
                  className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto] gap-4 border-t border-zinc-100 px-5 py-4 text-sm text-zinc-700 will-change-transform first:border-t-0"
                >
                  <span className="font-medium text-zinc-900">
                    {entry.name}
                  </span>
                  <span className="truncate">{entry.dining_hall_name}</span>
                  <span className="text-right font-semibold text-uconn-navy">
                    {formatEloForDisplay(entry.elo)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}
