import { useEffect, useRef, useState } from 'react';
import type { DishInfo } from '../types/meals';

const ELO_ANIM_MS = 880;

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
  outcomeGlow?: 'winner' | 'loser';
};

export function DishCard({
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
        'mt-8 text-lg font-bold text-zinc-700 md:text-xl',
        eloMotion
          ? ''
          : eloFadeIn
            ? `transition-all duration-500 ease-out ${
                fadeEntered
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-2 opacity-0'
              }`
            : '',
      ].join(' ')}
    >
      ELO:{' '}
      <span
        className={[
          'inline-block rounded-md px-1 tabular-nums text-2xl font-semibold md:text-2xl',
          outcomeGlow === 'winner'
            ? 'text-emerald-400'
            : outcomeGlow === 'loser'
              ? 'text-red-500'
              : 'text-uconn-navy',
        ].join(' ')}
      >
        {formatElo(displayElo)}
      </span>
    </p>
  ) : null;

  return (
    <article
      className={[
        'flex min-h-[22rem] flex-col rounded-3xl border border-zinc-200 bg-white p-8 text-left shadow-md transition-shadow md:min-h-[26rem] md:p-10 lg:min-h-[28rem]',
        selected ? 'border-uconn-navy ring-4 ring-uconn-navy/25' : '',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer hover:border-uconn-navy/35',
      ].join(' ')}
    >
      <button
        type='button'
        disabled={disabled}
        onClick={onSelect}
        className='grow text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-uconn-navy focus-visible:ring-offset-2 focus-visible:ring-offset-white'
      >
        <h3 className='text-2xl font-bold leading-tight text-zinc-900 md:text-2xl lg:text-3xl'>
          {dish.dish_name}
        </h3>
        <p className='mt-3 text-base font-bold text-zinc-600 md:text-2xl'>
          {dish.dining_hall_name}
        </p>
        {eloRow}
      </button>
      <button
        type='button'
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onShowNutrition();
        }}
        className='mt-6 w-full rounded-xl border border-zinc-200 bg-zinc-50 py-4 text-base font-medium text-uconn-navy-muted hover:bg-zinc-100 disabled:opacity-50 md:text-lg'
      >
        Nutritional info
      </button>
    </article>
  );
}

function formatElo(r: number): string {
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
