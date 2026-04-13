import { motion } from "motion/react";
import { formatEloForDisplay } from "../utils/eloDisplay";
import type { LeaderboardEntry } from "../types/leaderboard";

function NutritionInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        fill="currentColor"
        d="M12 10.25a.85.85 0 01.85.85v4.35a.85.85 0 11-1.7 0v-4.35a.85.85 0 01.85-.85z"
      />
      <circle cx="12" cy="7.35" r="1" fill="currentColor" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M8 3.75v3.25M16 3.75v3.25" />
      <rect x="3.75" y="6.25" width="16.5" height="14.5" rx="1.75" stroke="currentColor" strokeWidth="1.75" />
      <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M3.75 11.25h16.5" />
    </svg>
  );
}

const actionClass =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-uconn-navy hover:bg-uconn-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2";

type Props = {
  entries: LeaderboardEntry[];
  onShowNutrition: (entry: LeaderboardEntry) => void;
  onShowAvailability: (entry: LeaderboardEntry) => void;
};

const layoutTransition = {
  layout: {
    type: "spring" as const,
    stiffness: 340,
    damping: 32,
    mass: 0.9,
  },
};

type Rank = 1 | 2 | 3;

function rankBadgeClass(rank: Rank, filled: boolean): string {
  const ring = "ring-[3px] ring-white sm:ring-4";
  if (!filled) {
    return [
      "bg-zinc-200 text-zinc-500 shadow-sm",
      ring,
      "h-8 w-8 text-xs font-bold sm:h-9 sm:w-9",
    ].join(" ");
  }
  switch (rank) {
    case 1:
      return [
        "bg-uconn-navy text-white shadow-lg shadow-uconn-navy/40",
        ring,
        "h-10 w-10 text-base font-bold sm:h-11 sm:w-11 sm:text-lg",
      ].join(" ");
    case 2:
      return [
        "bg-gradient-to-b from-zinc-50 to-zinc-200 text-zinc-800 shadow-md shadow-zinc-400/25",
        ring,
        "h-9 w-9 text-sm font-bold sm:h-10 sm:w-10 sm:text-base",
      ].join(" ");
    case 3:
      return [
        "bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-md shadow-amber-600/20",
        ring,
        "h-8 w-8 text-xs font-bold sm:h-9 sm:w-9 sm:text-sm",
      ].join(" ");
  }
}

/** Extra top padding for 1st: larger badge overlaps more; match visual gap to 2nd/3rd. */
function cardPaddingClass(rank: Rank): string {
  if (rank === 1) return "pt-7 sm:pt-8";
  return "pt-6 sm:pt-7";
}

function slotMeta(rank: Rank): {
  podiumClass: string;
  shellClass: string;
} {
  switch (rank) {
    case 1:
      return {
        podiumClass: "min-h-[8.5rem] sm:min-h-[10.5rem]",
        shellClass:
          "border-uconn-navy/25 bg-gradient-to-b from-uconn-navy/12 to-uconn-navy/6",
      };
    case 2:
      return {
        podiumClass: "min-h-[4.25rem] sm:min-h-[5.25rem]",
        shellClass: "border-zinc-200 bg-gradient-to-b from-zinc-100 to-zinc-50",
      };
    case 3:
      return {
        podiumClass: "min-h-[2.75rem] sm:min-h-[3.5rem]",
        shellClass:
          "border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-amber-50/50",
      };
  }
}

function PodiumSlot({
  rank,
  entry,
  onShowNutrition,
  onShowAvailability,
}: {
  rank: Rank;
  entry: LeaderboardEntry | undefined;
  onShowNutrition: (entry: LeaderboardEntry) => void;
  onShowAvailability: (entry: LeaderboardEntry) => void;
}) {
  const { podiumClass, shellClass } = slotMeta(rank);
  return (
    <motion.div
      layout
      transition={layoutTransition.layout}
      className={[
        "flex min-w-0 w-full max-w-[10.5rem] flex-col justify-end sm:w-[10.5rem] sm:max-w-none",
        rank === 1 ? "order-1 sm:order-2 sm:w-[11.25rem]" : "",
        rank === 2 ? "order-2 sm:order-1" : "",
        rank === 3 ? "order-3 sm:order-3" : "",
      ].join(" ")}
    >
      <div className="relative z-0 mb-1.5 w-full">
        <span
          className={[
            "pointer-events-none absolute left-1/2 top-0 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full tabular-nums",
            rankBadgeClass(rank, Boolean(entry)),
          ].join(" ")}
          aria-hidden={entry ? undefined : true}
        >
          {rank}
        </span>
        <div
          className={[
            "w-full rounded-lg border border-zinc-200 bg-white px-2.5 pb-3 text-center shadow-sm sm:px-3 sm:pb-3.5",
            cardPaddingClass(rank),
            entry ? "" : "border-dashed bg-zinc-50/80",
          ].join(" ")}
        >
          {entry ? (
            <>
              <p className="break-words text-xs font-medium leading-snug text-zinc-900 sm:text-[0.8125rem]">
                {entry.name}
              </p>
              <p className="mt-1 text-[0.65rem] leading-tight text-zinc-600 sm:text-xs">
                {entry.dining_hall_name}
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                <button
                  type="button"
                  onClick={() => onShowNutrition(entry)}
                  className={actionClass}
                >
                  <span className="inline-flex size-[1em] items-center justify-center">
                    <NutritionInfoIcon className="h-full w-full" />
                  </span>
                  Nutrition
                </button>
                <button
                  type="button"
                  onClick={() => onShowAvailability(entry)}
                  className={actionClass}
                >
                  <span className="inline-flex size-[1em] items-center justify-center">
                    <CalendarIcon className="h-full w-full" />
                  </span>
                  Availability
                </button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[4rem] flex-col items-center justify-center gap-1 sm:min-h-[4.5rem]">
              <span className="sr-only">{`No dish in rank ${rank} yet`}</span>
              <span className="text-xs text-zinc-400" aria-hidden="true">
                —
              </span>
            </div>
          )}
        </div>
      </div>
      <motion.div
        layout
        transition={layoutTransition.layout}
        className={[
          "flex items-center justify-center rounded-t-md border-x border-t px-2 py-2 shadow-inner sm:py-3",
          shellClass,
          podiumClass,
        ].join(" ")}
        aria-hidden={entry ? undefined : true}
      >
        {entry ? (
          <span className="text-base font-semibold tabular-nums text-uconn-navy sm:text-lg">
            {formatEloForDisplay(entry.elo)}
          </span>
        ) : null}
      </motion.div>
    </motion.div>
  );
}

/**
 * Olympic-style podium: visual order 2nd → 1st → 3rd (tallest center).
 * Pass `entries.slice(0, 3)` from the ordered leaderboard.
 */
export function LeaderboardPodium({
  entries,
  onShowNutrition,
  onShowAvailability,
}: Props) {
  const first = entries[0];
  const second = entries[1];
  const third = entries[2];

  if (!first && !second && !third) return null;

  return (
    <div
      className="shrink-0 border-b border-zinc-200 bg-zinc-50/50 px-4 py-5 sm:px-5 sm:py-6 md:px-6"
      aria-label="Top three"
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-center sm:gap-3 md:max-w-xl md:gap-4">
        <PodiumSlot key="podium-2" rank={2} entry={second} onShowNutrition={onShowNutrition} onShowAvailability={onShowAvailability} />
        <PodiumSlot key="podium-1" rank={1} entry={first} onShowNutrition={onShowNutrition} onShowAvailability={onShowAvailability} />
        <PodiumSlot key="podium-3" rank={3} entry={third} onShowNutrition={onShowNutrition} onShowAvailability={onShowAvailability} />
      </div>
    </div>
  );
}
