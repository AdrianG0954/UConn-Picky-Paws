/**
 * Dish as returned by GET /meals/random and used across head-to-head.
 * `meal_type` is part of the database primary key together with `dining_hall_id` and `dish_name`.
 */
export type DishInfo = {
  dish_name: string;
  dining_hall_id: string;
  dining_hall_name: string;
  meal_type: string;
  nutrition_info: Record<string, unknown>;
  elo_rating: number;
};

export type RandomMealsResponse = {
  meals: DishInfo[];
};

export type DiningHallOption = {
  id: string;
  name: string;
};
