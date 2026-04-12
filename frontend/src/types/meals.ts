/**
 * Dish as returned by GET /meals/random and used across head-to-head.
 * Rows are unique per (dining_hall_id, dish_name).
 */
export type DishInfo = {
  dish_name: string;
  dining_hall_id: string;
  dining_hall_name: string;
  nutrition_info: Record<string, unknown>;
  elo_rating: number;
};

export type RandomMealsResponse = {
  meals: DishInfo[];
};

export type AvailabilityEntry = {
  meal: string;
  dining_hall: string;
};

export type DayAvailability = {
  date: string;
  availabilities: AvailabilityEntry[];
};

export type FoodAvailabilityResponse = {
  food_item: string;
  week_start: string;
  week_end: string;
  days: DayAvailability[];
};

/** Shape of GET /dining-halls items; re-exported from `types/leaderboard.ts` for convenience. */
export type DiningHallOption = {
  id: string;
  name: string;
};
