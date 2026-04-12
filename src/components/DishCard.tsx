import { memo, useEffect, useRef, useState } from "react";
import type { DishInfo } from "../types/meals";
import { formatEloForDisplay } from "../utils/eloDisplay";

const ELO_ANIM_MS = 880;

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

const cardTextActionClass =
  "inline-flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-uconn-navy hover:bg-uconn-navy/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50 md:text-base lg:text-lg";

type Props = {
  dish: DishInfo;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onShowNutrition: () => void;
  /** When false, the ELO row is not shown (blind comparison). */
  showElo: boolean;
  /** Animate ELO from old rating to new (lock-in). Omit for static or fade-only reveal. */
  eloMotion?: { from: number; to: number } | null;
  /** Fade in the ELO row (e.g. “Can’t decide” reveal). Ignored while `eloMotion` is set. */
  eloFadeIn?: boolean;
  /** Lock-in ELO animation: glow the rating number (green = winner, red = loser). */
  outcomeGlow?: "winner" | "loser";
};

export const DishCard = memo(function DishCard({
  dish,
  selected,
  disabled,
  onSelect,
  onShowNutrition,
  showElo,
  eloMotion,
  eloFadeIn = false,
  outcomeGlow,
}: Props) {
  const [displayElo, setDisplayElo] = useState(dish.elo_rating);
  const [fadeEntered, setFadeEntered] = useState(false);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    if (!showElo) {
      setFadeEntered(false);
      setDisplayElo(dish.elo_rating);
      return;
    }

    if (eloMotion) {
      setFadeEntered(true);
      const from = eloMotion.from;
      const to = eloMotion.to;
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / ELO_ANIM_MS);
        const eased = 1 - (1 - t) ** 3;
        setDisplayElo(from + (to - from) * eased);
        if (t < 1) {
          animFrame.current = requestAnimationFrame(tick);
        } else {
          setDisplayElo(to);
        }
      };

      setDisplayElo(from);
      animFrame.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animFrame.current);
    }

    setDisplayElo(dish.elo_rating);
    setFadeEntered(false);
    const id = requestAnimationFrame(() => setFadeEntered(true));
    return () => cancelAnimationFrame(id);
  }, [showElo, eloMotion, dish.elo_rating, eloMotion?.from, eloMotion?.to]);

  const eloRow = showElo ? (
    <p
      className={[
        "mt-4 text-base font-bold text-zinc-700 md:mt-6 md:text-lg lg:mt-8 lg:text-xl",
        eloMotion
          ? ""
          : eloFadeIn
            ? `transition-all duration-500 ease-out ${
                fadeEntered
                  ? "translate-y-0 opacity-100"
                  : "translate-y-2 opacity-0"
              }`
            : "",
      ].join(" ")}
    >
      ELO:{" "}
      <span
        className={[
          "inline-block rounded-md px-1 tabular-nums text-2xl font-semibold md:text-2xl",
          outcomeGlow === "winner"
            ? "text-emerald-400"
            : outcomeGlow === "loser"
              ? "text-red-500"
              : "text-uconn-navy",
        ].join(" ")}
      >
        {formatEloForDisplay(displayElo)}
      </span>
    </p>
  ) : null;

  return (
    <article
      className={[
        "flex min-h-0 w-full flex-col rounded-3xl border border-zinc-200 bg-white p-5 text-left shadow-md transition-shadow sm:min-h-[17rem] sm:p-6 md:min-h-[20rem] md:p-8 lg:min-h-[22rem] lg:p-10",
        selected ? "border-uconn-navy ring-4 ring-uconn-navy/25" : "",
        disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:border-uconn-navy/35",
      ].join(" ")}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className="grow text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <h3 className="text-xl font-bold leading-tight text-zinc-900 sm:text-2xl lg:text-3xl">
          {dish.dish_name}
        </h3>
        <p className="mt-2 text-sm font-bold text-zinc-600 sm:text-base md:mt-3 md:text-xl lg:text-2xl">
          {dish.dining_hall_name}
        </p>
        {eloRow}
      </button>
      <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:mt-6 lg:mt-8">
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onShowNutrition();
          }}
          className={`${cardTextActionClass} self-start`}
        >
          <span className="inline-flex size-[1.15em] shrink-0 items-center justify-center">
            <NutritionInfoIcon className="h-full w-full" />
          </span>
          Nutritional Info
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={`${cardTextActionClass} self-end sm:self-auto`}
        >
          Check availability
          <span className="inline-flex size-[1.15em] shrink-0 items-center justify-center">
            <CalendarIcon className="h-full w-full" />
          </span>
        </button>
      </div>
    </article>
  );
});

DishCard.displayName = "DishCard";
