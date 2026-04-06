/**
 * Elo values from the API are floats; the UI shows whole numbers only.
 * Keep this in one place so DishCard, leaderboard, and future views stay consistent.
 */
export function formatEloForDisplay(rating: number): string {
  return String(Math.ceil(rating));
}
