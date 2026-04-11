import { useEffect, useState } from "react";

/**
 * UI countdown to the next weekly reset at Sunday 00:00 in the user's local timezone.
 * If the product’s real reset schedule changes, update this component and any server-side jobs together.
 */

const TICK_MS = 1000;

function nextSundayMidnight(from: Date): Date {
  const next = new Date(from);
  // Jump to Sunday on the same week: Sun=0 … Sat=6 → days to add is (7 - weekday) % 7.
  next.setDate(from.getDate() + ((7 - from.getDay()) % 7));
  next.setHours(0, 0, 0, 0);
  if (next.getTime() <= from.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0:00:00";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (days > 0) {
    return `${days}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function ResetCountdown() {
  const [remainingMs, setRemainingMs] = useState(() => {
    const target = nextSundayMidnight(new Date());
    return Math.max(0, target.getTime() - Date.now());
  });

  useEffect(() => {
    const tick = () => {
      const target = nextSundayMidnight(new Date());
      setRemainingMs(Math.max(0, target.getTime() - Date.now()));
    };
    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="mx-auto mt-5 max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-3 text-center shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Time until reset
      </p>
      <p
        className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-uconn-navy"
        aria-live="polite"
        aria-atomic="true"
      >
        {formatRemaining(remainingMs)}
      </p>
    </div>
  );
}
