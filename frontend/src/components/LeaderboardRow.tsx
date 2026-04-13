import { memo } from "react";
import { motion } from "motion/react";
import type { LeaderboardEntry } from "../types/leaderboard";
import { formatEloForDisplay } from "../utils/eloDisplay";

function NutritionInfoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
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
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M8 3.75v3.25M16 3.75v3.25"
      />
      <rect
        x="3.75"
        y="6.25"
        width="16.5"
        height="14.5"
        rx="1.75"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M3.75 11.25h16.5"
      />
    </svg>
  );
}

const actionClass =
  "inline-flex items-center justify-center rounded-lg p-1.5 text-uconn-navy hover:bg-uconn-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2";

type Props = {
  entry: LeaderboardEntry;
  rank: number;
  onShowNutrition: (entry: LeaderboardEntry) => void;
  onShowAvailability: (entry: LeaderboardEntry) => void;
};

const rowTransition = {
  layout: {
    type: "spring" as const,
    stiffness: 340,
    damping: 32,
    mass: 0.9,
  },
  opacity: { duration: 0.18, ease: "easeOut" as const },
  scale: { duration: 0.18, ease: "easeOut" as const },
};

/**
 * Memoized row; `layout="position"` animates reorder when Elo snapshots change.
 */
export const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  rank,
  onShowNutrition,
  onShowAvailability,
}: Props) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={rowTransition}
      className="grid grid-cols-[2.75rem_minmax(0,1.5fr)_minmax(0,1.1fr)_auto] items-start gap-3 border-t border-zinc-100 px-4 py-4 text-sm text-zinc-700 will-change-transform first:border-t-0 sm:grid-cols-[3rem_minmax(0,1.5fr)_minmax(0,1.15fr)_auto] sm:gap-4 sm:px-5"
    >
      <span className="pt-0.5 tabular-nums text-zinc-500">{rank}.</span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate font-medium text-zinc-900">
            {entry.name}
          </span>
          <button
            type="button"
            onClick={() => onShowNutrition(entry)}
            className={actionClass}
            aria-label={`Show nutrition info for ${entry.name}`}
            title="Nutritional Info"
          >
            <span className="inline-flex size-4 items-center justify-center">
              <NutritionInfoIcon className="h-full w-full" />
            </span>
          </button>
          <button
            type="button"
            onClick={() => onShowAvailability(entry)}
            className={actionClass}
            aria-label={`Check availability for ${entry.name}`}
            title="Check Availability"
          >
            <span className="inline-flex size-4 items-center justify-center">
              <CalendarIcon className="h-full w-full" />
            </span>
          </button>
        </div>
      </div>
      <span className="min-w-0 truncate">{entry.dining_hall_name}</span>
      <span className="pt-0.5 text-right font-semibold text-uconn-navy">
        {formatEloForDisplay(entry.elo)}
      </span>
    </motion.div>
  );
});

LeaderboardRow.displayName = "LeaderboardRow";
