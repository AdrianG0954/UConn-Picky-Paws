/** Response from PATCH /meals/elo (raw floats; format for display with `formatEloForDisplay`). */
export type EloUpdateResponse = {
  winner_new_elo: number;
  loser_new_elo: number;
};

/** Request body for PATCH /meals/elo; dish fields must match a single `dishes` row. */
export type EloPatchBody = {
  winner: { name: string; dining_hall_id: string };
  loser: { name: string; dining_hall_id: string };
  draw: boolean;
};
