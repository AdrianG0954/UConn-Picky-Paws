import { useCallback, useEffect, useState } from 'react';
import { fetchRandomMeals, patchMealElo } from '../api';
import { DishCard } from '../components/DishCard';
import { NutritionModal } from '../components/NutritionModal';
import type { DishInfo } from '../types/meals';
import boneImg from '../assets/paw.png';
import huskyImg from '../assets/Husky-PNG-Photo.png';

type Pair = [DishInfo, DishInfo];

const ELO_LOCK_IN_HOLD_MS = 1500;
const ELO_CANT_DECIDE_HOLD_MS = 1500;

type EloLockInState = {
  winnerSlot: 0 | 1;
  winnerFrom: number;
  winnerTo: number;
  loserFrom: number;
  loserTo: number;
};

/**
 * Static husky art; bone rotates toward the selected card (same mapping as the old chevron).
 * Bone asset should point right in its file; adjust with constant if your art faces another direction.
 */
function PairSelectionArrow({
  selectedIndex,
}: {
  selectedIndex: 0 | 1 | null;
}) {
  const boneRotationClass =
    selectedIndex === null
      ? '-rotate-90'
      : selectedIndex === 0
        ? '-rotate-90 md:rotate-180'
        : 'rotate-90 md:rotate-0';

  return (
    <div
      className='flex shrink-0 flex-col items-center justify-center gap-3 py-4 md:min-w-[6rem] md:self-stretch md:gap-4 md:py-0 lg:min-w-[7rem]'
      aria-hidden
    >
      <img
        src={huskyImg}
        alt=''
        draggable={false}
        className='h-24 w-auto max-w-[min(100%,10rem)] select-none object-contain md:h-28 lg:h-32'
      />
      <img
        src={boneImg}
        alt=''
        draggable={false}
        className={`h-28 w-28 origin-center select-none object-contain transition-transform duration-300 ease-out ${boneRotationClass}`}
      />
    </div>
  );
}

export function HeadToHead() {
  const [pair, setPair] = useState<Pair | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nutritionDish, setNutritionDish] = useState<DishInfo | null>(null);
  /** After “Can’t decide”: brief ELO reveal before swapping pair. */
  const [cantDecideElo, setCantDecideElo] = useState(false);
  /** After lock-in PATCH: animate ELOs, then fetch replacement meal. */
  const [eloLockIn, setEloLockIn] = useState<EloLockInState | null>(null);

  const showEloOnCards = cantDecideElo || eloLockIn !== null;

  const loadInitialPair = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const meals = await fetchRandomMeals(2);
      if (meals.length !== 2)
        throw new Error('Expected two meals from the server.');
      setPair([meals[0], meals[1]]);
      setSelectedIndex(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dishes.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialPair();
  }, [loadInitialPair]);

  const handleCantDecide = async () => {
    setError(null);
    setBusy(true);
    try {
      setCantDecideElo(true);
      await new Promise((r) => setTimeout(r, ELO_CANT_DECIDE_HOLD_MS));
      const meals = await fetchRandomMeals(2);
      if (meals.length !== 2)
        throw new Error('Expected two meals from the server.');
      setPair([meals[0], meals[1]]);
      setSelectedIndex(null);
      setCantDecideElo(false);
    } catch (e) {
      setCantDecideElo(false);
      setError(e instanceof Error ? e.message : 'Failed to load new pair.');
    } finally {
      setBusy(false);
    }
  };

  /** Winner keeps their slot; loser is replaced; PATCH updates winner ELO on the board. */
  const handleLockIn = async () => {
    if (!pair || selectedIndex === null) return;
    const winnerSlot = selectedIndex;
    const loserSlot: 0 | 1 = winnerSlot === 0 ? 1 : 0;
    const winner = pair[winnerSlot];
    const loser = pair[loserSlot];

    setError(null);
    setBusy(true);
    try {
      const { winner_new_elo, loser_new_elo } = await patchMealElo(
        winner,
        loser,
        false,
      );
      setEloLockIn({
        winnerSlot,
        winnerFrom: winner.elo_rating,
        winnerTo: winner_new_elo,
        loserFrom: loser.elo_rating,
        loserTo: loser_new_elo,
      });
      await new Promise((r) => setTimeout(r, ELO_LOCK_IN_HOLD_MS));
      const meals = await fetchRandomMeals(1, [winner, loser]);
      if (meals.length !== 1) throw new Error('Expected one replacement meal.');
      const next: Pair = [...pair];
      next[winnerSlot] = { ...winner, elo_rating: winner_new_elo };
      next[loserSlot] = meals[0];
      setPair(next);
      setEloLockIn(null);
      setSelectedIndex(null);
    } catch (e) {
      setEloLockIn(null);
      setError(e instanceof Error ? e.message : 'Could not lock in this pick.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className='mx-auto w-full max-w-6xl px-4 py-10 md:px-6'>
        <header className='mb-10 text-center'>
          <h1 className='text-3xl font-semibold tracking-tight text-uconn-navy md:text-4xl'>
            Picky Paws
          </h1>
          <p className='mt-2 text-zinc-600'>
            Rank your favorite UConn Dining Halls and their food!
          </p>
        </header>

        {error ? (
          <div
            className='mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
            role='alert'
          >
            {error}
          </div>
        ) : null}

        {!pair && !error ? (
          <p className='text-center text-zinc-500'>Loading dishes…</p>
        ) : null}

        {pair ? (
          <>
            <div className='mb-10 grid grid-cols-1 items-stretch gap-y-6 md:grid-cols-[1fr_auto_1fr] md:gap-x-10 lg:gap-x-20'>
              <DishCard
                dish={pair[0]}
                selected={selectedIndex === 0}
                disabled={busy}
                onSelect={() => setSelectedIndex(0)}
                onShowNutrition={() => setNutritionDish(pair[0])}
                showElo={showEloOnCards}
                eloMotion={
                  eloLockIn
                    ? eloLockIn.winnerSlot === 0
                      ? { from: eloLockIn.winnerFrom, to: eloLockIn.winnerTo }
                      : { from: eloLockIn.loserFrom, to: eloLockIn.loserTo }
                    : undefined
                }
                eloFadeIn={cantDecideElo && !eloLockIn}
                outcomeGlow={
                  eloLockIn
                    ? eloLockIn.winnerSlot === 0
                      ? 'winner'
                      : 'loser'
                    : undefined
                }
              />
              <PairSelectionArrow selectedIndex={selectedIndex} />
              <DishCard
                dish={pair[1]}
                selected={selectedIndex === 1}
                disabled={busy}
                onSelect={() => setSelectedIndex(1)}
                onShowNutrition={() => setNutritionDish(pair[1])}
                showElo={showEloOnCards}
                eloMotion={
                  eloLockIn
                    ? eloLockIn.winnerSlot === 1
                      ? { from: eloLockIn.winnerFrom, to: eloLockIn.winnerTo }
                      : { from: eloLockIn.loserFrom, to: eloLockIn.loserTo }
                    : undefined
                }
                eloFadeIn={cantDecideElo && !eloLockIn}
                outcomeGlow={
                  eloLockIn
                    ? eloLockIn.winnerSlot === 1
                      ? 'winner'
                      : 'loser'
                    : undefined
                }
              />
            </div>

            <div className='mx-auto grid w-full max-w-2xl grid-cols-2 gap-4 md:gap-6'>
              <button
                type='button'
                disabled={busy || selectedIndex === null}
                onClick={() => void handleLockIn()}
                className='min-w-0 rounded-xl bg-uconn-navy px-4 py-4 text-lg font-semibold text-white shadow-sm hover:bg-uconn-navy-dark disabled:cursor-not-allowed disabled:opacity-50'
              >
                {busy ? 'Working…' : 'Lock in'}
              </button>
              <button
                type='button'
                disabled={busy}
                onClick={() => void handleCantDecide()}
                className='min-w-0 rounded-xl border border-zinc-300 bg-white px-4 py-4 text-lg font-medium text-zinc-800 shadow-sm hover:border-uconn-navy/30 hover:bg-zinc-50 disabled:opacity-50'
              >
                Can&apos;t decide
              </button>
            </div>
          </>
        ) : null}
      </div>

      <NutritionModal
        dish={nutritionDish}
        onClose={() => setNutritionDish(null)}
      />
    </>
  );
}
