import { useCallback, useEffect, useState } from 'react'
import { fetchRandomMeals, patchMealElo } from './api'
import { DishCard } from './DishCard'
import { NutritionModal } from './NutritionModal'
import type { DishInfo } from './types'

type Pair = [DishInfo, DishInfo]

/** Chevron points right by default; rotations: up = neutral, toward card 0 / card 1 when selected. */
function PairSelectionArrow({ selectedIndex }: { selectedIndex: 0 | 1 | null }) {
  const rotationClass =
    selectedIndex === null
      ? '-rotate-90'
      : selectedIndex === 0
        ? '-rotate-90 md:rotate-180'
        : 'rotate-90 md:rotate-0'

  return (
    <div
      className="flex shrink-0 items-center justify-center py-4 md:min-w-[4.5rem] md:self-stretch md:py-0 lg:min-w-[5.5rem]"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-14 w-14 text-violet-600 transition-transform duration-300 ease-out dark:text-violet-400 md:h-20 md:w-20 lg:h-24 lg:w-24 ${rotationClass}`}
      >
        <path d="M9 5l7 7-7 7" />
      </svg>
    </div>
  )
}

export function HeadToHead() {
  const [pair, setPair] = useState<Pair | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nutritionDish, setNutritionDish] = useState<DishInfo | null>(null)

  const loadInitialPair = useCallback(async () => {
    setError(null)
    setBusy(true)
    try {
      const meals = await fetchRandomMeals(2)
      if (meals.length !== 2) throw new Error('Expected two meals from the server.')
      setPair([meals[0], meals[1]])
      setSelectedIndex(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dishes.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void loadInitialPair()
  }, [loadInitialPair])

  const handleCantDecide = async () => {
    setError(null)
    setBusy(true)
    try {
      const meals = await fetchRandomMeals(2)
      if (meals.length !== 2) throw new Error('Expected two meals from the server.')
      setPair([meals[0], meals[1]])
      setSelectedIndex(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load new pair.')
    } finally {
      setBusy(false)
    }
  }

  /** Winner keeps their slot; loser is replaced; PATCH updates winner ELO on the board. */
  const handleLockIn = async () => {
    if (!pair || selectedIndex === null) return
    const winnerSlot = selectedIndex
    const loserSlot: 0 | 1 = winnerSlot === 0 ? 1 : 0
    const winner = pair[winnerSlot]
    const loser = pair[loserSlot]

    setError(null)
    setBusy(true)
    try {
      const { winner_new_elo } = await patchMealElo(winner, loser, false)
      const meals = await fetchRandomMeals(1, [winner, loser])
      if (meals.length !== 1) throw new Error('Expected one replacement meal.')
      const next: Pair = [...pair]
      next[winnerSlot] = { ...winner, elo_rating: winner_new_elo }
      next[loserSlot] = meals[0]
      setPair(next)
      setSelectedIndex(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not lock in this pick.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-4xl">
            Picky Paws
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Rate your favorite dining hall food (WIP).
          </p>
        </header>

        {error ? (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {!pair && !error ? (
          <p className="text-center text-zinc-500">Loading dishes…</p>
        ) : null}

        {pair ? (
          <>
            <div className="mb-10 grid grid-cols-1 items-stretch gap-y-6 md:grid-cols-[1fr_auto_1fr] md:gap-x-10 lg:gap-x-20">
              <DishCard
                dish={pair[0]}
                selected={selectedIndex === 0}
                disabled={busy}
                onSelect={() => setSelectedIndex(0)}
                onShowNutrition={() => setNutritionDish(pair[0])}
              />
              <PairSelectionArrow selectedIndex={selectedIndex} />
              <DishCard
                dish={pair[1]}
                selected={selectedIndex === 1}
                disabled={busy}
                onSelect={() => setSelectedIndex(1)}
                onShowNutrition={() => setNutritionDish(pair[1])}
              />
            </div>

            <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-4 md:gap-6">
              <button
                type="button"
                disabled={busy || selectedIndex === null}
                onClick={() => void handleLockIn()}
                className="min-w-0 rounded-xl bg-violet-600 px-4 py-4 text-lg font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
              >
                {busy ? 'Working…' : 'Lock in'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCantDecide()}
                className="min-w-0 rounded-xl border border-zinc-300 bg-white px-4 py-4 text-lg font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                Can&apos;t decide
              </button>
            </div>
          </>
        ) : null}
      </div>

      <NutritionModal dish={nutritionDish} onClose={() => setNutritionDish(null)} />
    </>
  )
}
