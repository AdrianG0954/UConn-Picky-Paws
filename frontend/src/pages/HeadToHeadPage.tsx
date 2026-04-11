/**
 * Head-to-head ranking: load two dishes, vote (PATCH Elo), replace loser only;
 * “Can’t decide” swaps both. Scope (which halls) comes from useRankDiningHallScope.
 */
import { useCallback, useEffect, useState } from "react";
import { fetchRandomMeals, patchMealElo } from "../api";
import { DishCard } from "../components/DishCard";
import { NutritionModal } from "../components/NutritionModal";
import { PairSelectionArrow } from "../components/PairSelectionArrow";
import { ResetCountdown } from "../components/ResetCountdown";
import { RankScopeBar } from "../components/RankScopeBar";
import { useRankDiningHallScope } from "../hooks/useRankDiningHallScope";
import type { DishInfo } from "../types/meals";
import { errorMessage } from "../utils/errorMessage";
import type { EloLockInState } from "../utils/headToHeadElo";
import { AvailabilityModal } from "../components/AvailabilityModal/AvailabilityModal";

type Pair = [DishInfo, DishInfo];

/** Pause after vote so Elo animation finishes before fetching the replacement dish. */
const ELO_LOCK_IN_HOLD_MS = 1500;
/** Pause before loading a new pair so both Elos flash briefly. */
const ELO_CANT_DECIDE_HOLD_MS = 1500;

export function HeadToHead() {
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] =
    useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const clearScopeApplyError = useCallback(() => setError(null), []);
  const scope = useRankDiningHallScope({
    onApplyInvalid: setError,
    onApplyValid: clearScopeApplyError,
  });

  const [pair, setPair] = useState<Pair | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null);
  const [busy, setBusy] = useState(false);
  const [nutritionDish, setNutritionDish] = useState<DishInfo | null>(null);
  const [cantDecideElo, setCantDecideElo] = useState(false);
  /** Set after PATCH until replacement meal arrives; drives per-card Elo animation. */
  const [eloLockIn, setEloLockIn] = useState<EloLockInState | null>(null);

  const showEloOnCards = cantDecideElo || eloLockIn !== null;

  const onSelectCard0 = useCallback(() => setSelectedIndex(0), []);
  const onSelectCard1 = useCallback(() => setSelectedIndex(1), []);
  const onShowNutrition0 = useCallback(() => {
    if (pair) setNutritionDish(pair[0]);
  }, [pair]);
  const onShowNutrition1 = useCallback(() => {
    if (pair) setNutritionDish(pair[1]);
  }, [pair]);

  const loadInitialPair = useCallback(async () => {
    // Wait until scope hook has at least one hall name (empty list is invalid for the API).
    if (scope.activeFilterNames.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const meals = await fetchRandomMeals(2, scope.activeFilterNames);
      if (meals.length !== 2)
        throw new Error("Expected two meals from the server.");
      setPair([meals[0], meals[1]]);
      setSelectedIndex(null);
    } catch (e) {
      setError(errorMessage(e, "Failed to load dishes."));
    } finally {
      setBusy(false);
    }
  }, [scope.activeFilterNames]);

  // New scope (first load or Apply) → fetch a fresh pair for that hall set.
  useEffect(() => {
    if (scope.activeFilterNames.length === 0) return;
    void loadInitialPair();
  }, [scope.activeFilterNames, loadInitialPair]);

  const handleCantDecide = async () => {
    setError(null);
    setBusy(true);
    try {
      setCantDecideElo(true);
      await new Promise((r) => setTimeout(r, ELO_CANT_DECIDE_HOLD_MS));
      const meals = await fetchRandomMeals(2, scope.activeFilterNames);
      if (meals.length !== 2)
        throw new Error("Expected two meals from the server.");
      setPair([meals[0], meals[1]]);
      setSelectedIndex(null);
      setCantDecideElo(false);
    } catch (e) {
      setCantDecideElo(false);
      setError(errorMessage(e, "Failed to load new pair."));
    } finally {
      setBusy(false);
    }
  };

  const handleLockIn = async () => {
    if (!pair || selectedIndex === null) return;
    // Winner stays in place; loser slot gets one new dish (count=1 + exclude winner+loser).
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
      const meals = await fetchRandomMeals(1, scope.activeFilterNames, [
        winner,
        loser,
      ]);
      if (meals.length !== 1) throw new Error("Expected one replacement meal.");
      const next: Pair = [...pair];
      next[winnerSlot] = { ...winner, elo_rating: winner_new_elo };
      next[loserSlot] = meals[0];
      setPair(next);
      setEloLockIn(null);
      setSelectedIndex(null);
    } catch (e) {
      setEloLockIn(null);
      setError(errorMessage(e, "Could not vote for this dish."));
    } finally {
      setBusy(false);
    }
  };

  /** Scope UI and dish loads only run once halls exist. */
  const hallsReadyWithOptions =
    scope.hallsStatus === "ready" && scope.hallOptions.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-10 xl:max-w-[78rem]">
        <header className="mb-4 text-center md:mb-8">
          <h1 className="text-4xl font-semibold tracking-tight text-uconn-navy sm:text-5xl md:text-6xl">
            Picky Paws
          </h1>
          <p className="mt-1 text-sm text-zinc-600 md:mt-2 md:text-base">
            Rank your favorite UConn Dining Halls and their weekly menus!
          </p>
          <p className="text-xs text-zinc-600 mt-1 mb-[-15px]">
            Menus are refreshed every Sunday at 12:00 AM.
          </p>
          <ResetCountdown />
        </header>

        {scope.hallsStatus === "loading" ? (
          <p className="mb-6 text-center text-sm text-zinc-500">
            Loading dining halls…
          </p>
        ) : null}

        {scope.hallsStatus === "error" && scope.hallsError ? (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {scope.hallsError}
          </div>
        ) : null}

        {scope.hallsStatus === "ready" && scope.hallOptions.length === 0 ? (
          <p className="mb-6 text-center text-sm text-zinc-600">
            No dining halls are available yet. Check back later.
          </p>
        ) : null}

        {hallsReadyWithOptions ? (
          <RankScopeBar
            hallOptions={scope.hallOptions}
            filterMode={scope.filterMode}
            onFilterModeChange={scope.setFilterMode}
            subsetIds={scope.subsetIds}
            onToggleHall={scope.toggleSubsetHall}
            onSelectAllSubset={scope.selectAllSubset}
            onClearSubset={scope.clearSubset}
            busy={busy}
            applyDisabled={busy || scope.scopeSelectionMatchesApplied}
            onApply={() => void scope.applyScope()}
          />
        ) : null}

        {error ? (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {hallsReadyWithOptions && !pair && !error ? (
          <p className="text-center text-zinc-500">Loading dishes…</p>
        ) : null}

        {pair ? (
          <>
            <div className="mb-6 grid grid-cols-1 items-stretch gap-y-4 md:mb-10 md:grid-cols-[1fr_auto_1fr] md:gap-x-8 md:gap-y-6 lg:gap-x-12 lg:gap-y-6">
              <div className="min-w-0">
                <DishCard
                  dish={pair[0]}
                  selected={selectedIndex === 0}
                  disabled={busy}
                  onSelect={onSelectCard0}
                  onShowNutrition={onShowNutrition0}
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
                        ? "winner"
                        : "loser"
                      : undefined
                  }
                  setIsAvailabilityModalOpen={setIsAvailabilityModalOpen}
                />
              </div>
              <PairSelectionArrow selectedIndex={selectedIndex} />
              <div className="min-w-0">
                <DishCard
                  dish={pair[1]}
                  selected={selectedIndex === 1}
                  disabled={busy}
                  onSelect={onSelectCard1}
                  onShowNutrition={onShowNutrition1}
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
                        ? "winner"
                        : "loser"
                      : undefined
                  }
                  setIsAvailabilityModalOpen={setIsAvailabilityModalOpen}
                />
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-4 md:gap-6">
              <button
                type="button"
                disabled={busy || selectedIndex === null}
                onClick={() => void handleLockIn()}
                className="min-w-0 rounded-xl bg-uconn-navy px-4 py-3 text-base font-semibold text-white shadow-sm hover:bg-uconn-navy-dark disabled:cursor-not-allowed disabled:opacity-50 md:py-4 md:text-lg"
              >
                {busy ? "Working…" : "Vote"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCantDecide()}
                className="min-w-0 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base font-medium text-zinc-800 shadow-sm hover:border-uconn-navy/30 hover:bg-zinc-50 disabled:opacity-50 md:py-4 md:text-lg"
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
      <AvailabilityModal
        isAvailabilityModalOpen={isAvailabilityModalOpen}
        setIsAvailabilityModalOpen={setIsAvailabilityModalOpen}
      />
    </div>
  );
}
