/** Snapshot for animating both cards after a vote, before the loser is replaced. */
export type EloLockInState = {
  winnerSlot: 0 | 1;
  winnerFrom: number;
  winnerTo: number;
  loserFrom: number;
  loserTo: number;
};

/** ELO-related props shared between the two head-to-head `DishCard`s. */
export type DishCardEloBundle = {
  eloMotion?: { from: number; to: number };
  eloFadeIn: boolean;
  outcomeGlow?: "winner" | "loser";
};

/** Maps lock-in or “can’t decide” state into the Elo props for left (0) or right (1) card. */
export function dishCardEloForSlot(
  slot: 0 | 1,
  eloLockIn: EloLockInState | null,
  cantDecideElo: boolean,
): DishCardEloBundle {
  const eloFadeIn = cantDecideElo && !eloLockIn;
  if (!eloLockIn) {
    return { eloFadeIn, eloMotion: undefined, outcomeGlow: undefined };
  }
  const winner = eloLockIn.winnerSlot === slot;
  return {
    eloMotion: winner
      ? { from: eloLockIn.winnerFrom, to: eloLockIn.winnerTo }
      : { from: eloLockIn.loserFrom, to: eloLockIn.loserTo },
    eloFadeIn,
    outcomeGlow: winner ? "winner" : "loser",
  };
}
