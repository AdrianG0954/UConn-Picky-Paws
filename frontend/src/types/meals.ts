/** Mirrors backend DishInfo */
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
