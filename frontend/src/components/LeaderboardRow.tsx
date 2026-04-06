import { memo } from "react";
import { motion } from "motion/react";
import { formatEloForDisplay } from "../lib/eloDisplay";
import type { LeaderboardEntry } from "../types/leaderboard";

type Props = {
  entry: LeaderboardEntry;
  rank: number;
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
      <span className="min-w-0">
        <span className="font-medium text-zinc-900">{entry.name}</span>
        <span className="mt-0.5 block truncate text-xs capitalize text-zinc-500">
          {entry.meal_type}
        </span>
      </span>
      <span className="min-w-0 truncate">{entry.dining_hall_name}</span>
      <span className="pt-0.5 text-right font-semibold text-uconn-navy">
        {formatEloForDisplay(entry.elo)}
      </span>
    </motion.div>
  );
});

LeaderboardRow.displayName = "LeaderboardRow";
