export type EloUpdateResponse = {
  winner_new_elo: number;
  loser_new_elo: number;
};

export type EloPatchBody = {
  winner: { name: string; dining_hall_id: string };
  loser: { name: string; dining_hall_id: string };
  draw: boolean;
};
