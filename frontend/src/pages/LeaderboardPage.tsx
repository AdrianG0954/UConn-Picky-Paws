import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fetchDiningHalls } from "../api";
import { AvailabilityModal } from "../components/AvailabilityModal";
import { LeaderboardPodium } from "../components/LeaderboardPodium";
import { LeaderboardRow } from "../components/LeaderboardRow";
import { NutritionModal } from "../components/NutritionModal";
import { useLeaderboardSocket } from "../hooks/useLeaderboardSocket";
import type {
  DiningHallTab,
  LeaderboardTab,
  ConnectionState,
  GlobalTab,
  DiningHallOption,
  LeaderboardEntry,
} from "../types/leaderboard";
import type { DishInfo } from "../types/meals";

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
  if (state === "disconnected") return "Live updates off";
  return "Connecting...";
}

function connectionDotClass(state: ConnectionState): string {
  if (state === "connected") {
    return "bg-green-600 shadow-[0_0_0_1px_rgb(34_197_94_/_0.14),0_0_10px_rgb(34_197_94_/_0.35)]";
  }

  return "bg-red-600 shadow-[0_0_0_1px_rgb(248_113_113_/_0.14),0_0_10px_rgb(248_113_113_/_0.32)]";
}

function leaderboardEntryToDish(entry: LeaderboardEntry): DishInfo {
  return {
    dish_name: entry.name,
    dining_hall_id: entry.dining_hall_id,
    dining_hall_name: entry.dining_hall_name,
    nutrition_info: entry.nutrition_info,
    elo_rating: entry.elo,
  };
}

export function LeaderboardPage() {
  const [tabs, setTabs] = useState<LeaderboardTab[]>([GLOBAL_TAB]);
  const [selectedTabKey, setSelectedTabKey] = useState<string>(GLOBAL_TAB.key);
  const [tabError, setTabError] = useState<string | null>(null);
  const [nutritionDish, setNutritionDish] = useState<DishInfo | null>(null);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [availabilityFoodItem, setAvailabilityFoodItem] = useState<
    string | null
  >(null);
  const [availabilityHallName, setAvailabilityHallName] = useState<
    string | null
  >(null);

  const selectedTab =
    tabs.find((tab) => tab.key === selectedTabKey) ?? GLOBAL_TAB;
  const { connectionState, entries, loading, socketError } =
    useLeaderboardSocket(selectedTab);

  function handleTabSelection(tab: LeaderboardTab) {
    if (tab.key === selectedTabKey) return;
    setSelectedTabKey(tab.key);
  }

  function handleShowNutrition(entry: LeaderboardEntry) {
    setNutritionDish(leaderboardEntryToDish(entry));
  }

  function handleShowAvailability(entry: LeaderboardEntry) {
    setAvailabilityFoodItem(entry.name);
    setAvailabilityHallName(entry.dining_hall_name);
    setIsAvailabilityModalOpen(true);
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
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
      <header className="mb-4 flex shrink-0 flex-col gap-2 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-uconn-navy sm:text-3xl md:text-4xl">
            Leaderboard
          </h1>
          <p className="mt-1 text-sm text-zinc-600 md:mt-2 md:text-base">
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
          className="mb-3 shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 md:mb-4 md:py-3"
          role="status"
        >
          {tabError}
        </div>
      ) : null}

      {socketError ? (
        <div
          className="mb-3 shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 md:mb-4 md:py-3"
          role="alert"
        >
          {socketError}
        </div>
      ) : null}

      <div className="mb-3 shrink-0 overflow-x-auto md:mb-4">
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
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
        aria-label="Leaderboard table"
      >
        {!loading && entries.length > 0 ? (
          <LeaderboardPodium
            entries={entries.slice(0, 3)}
            onShowNutrition={handleShowNutrition}
            onShowAvailability={handleShowAvailability}
          />
        ) : null}

        <div className="grid shrink-0 grid-cols-[2.75rem_minmax(0,1.5fr)_minmax(0,1.1fr)_auto] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1.15fr)_auto] sm:gap-4 sm:px-5 sm:py-4 sm:text-sm">
          <span className="tabular-nums">#</span>
          <span>Name</span>
          <span>Dining Hall</span>
          <span className="text-right">Elo</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto">
          {loading ? (
            <p className="px-5 py-6 text-sm text-zinc-500 md:py-8">
              Loading leaderboard...
            </p>
          ) : entries.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 md:py-8">
              No dishes are available for this leaderboard yet.
            </p>
          ) : entries.length <= 3 ? (
            <p className="px-5 py-6 text-sm text-zinc-500 md:py-8">
              No additional entries in this leaderboard.
            </p>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {entries.slice(3).map((entry, index) => (
                <LeaderboardRow
                  key={`${entry.dining_hall_id}:${entry.name}`}
                  entry={entry}
                  rank={index + 4}
                  onShowNutrition={handleShowNutrition}
                  onShowAvailability={handleShowAvailability}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>
      <NutritionModal
        dish={nutritionDish}
        onClose={() => setNutritionDish(null)}
      />
      <AvailabilityModal
        isAvailabilityModalOpen={isAvailabilityModalOpen}
        setIsAvailabilityModalOpen={setIsAvailabilityModalOpen}
        foodItem={availabilityFoodItem}
        hallName={availabilityHallName}
      />
    </div>
  );
}
