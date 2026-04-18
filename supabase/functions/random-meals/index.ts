import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  HttpError,
  errorResponse,
  handleOptions,
  jsonResponse,
  readJson,
  toHttpError,
} from "../_shared/http.ts";
import { requireAuthenticatedRequest } from "../_shared/auth.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";

type RandomMealsRequest = {
  count: 1 | 2;
  filterDiningHalls: string[];
  excludePairs?: Array<{
    dish_name: string;
    dining_hall_id: string;
  }>;
};

type DiningHallRow = {
  id: string;
  name: string;
};

type DishRow = {
  name: string;
  dining_hall_id: string;
  nutrition_info: Record<string, unknown>;
  elo_rating: number;
};

function shuffleInPlace<T>(items: T[]): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    await requireAuthenticatedRequest(req);
    const body = await readJson<RandomMealsRequest>(req);
    const count = body.count;
    const filterDiningHalls = Array.from(
      new Set((body.filterDiningHalls ?? []).filter(Boolean)),
    );

    if (count !== 1 && count !== 2) {
      throw new HttpError(400, "count must be either 1 or 2.");
    }
    if (filterDiningHalls.length === 0) {
      throw new HttpError(
        400,
        "filterDiningHalls must contain at least one hall.",
      );
    }

    const supabase = getServiceRoleClient();
    const { data: halls, error: hallsError } = await supabase
      .from("dining_halls")
      .select("id, name")
      .in("name", filterDiningHalls)
      .returns<DiningHallRow[]>();

    if (hallsError) {
      throw hallsError;
    }

    if (!halls || halls.length === 0) {
      throw new HttpError(400, `Failed to get ${count} random meals.`);
    }

    const hallIds = halls.map((hall) => hall.id);
    const hallNameById = new Map(halls.map((hall) => [hall.id, hall.name]));

    const { data: dishes, error: dishesError } = await supabase
      .from("dishes")
      .select("name, dining_hall_id, nutrition_info, elo_rating")
      .in("dining_hall_id", hallIds)
      .returns<DishRow[]>();

    if (dishesError) {
      throw dishesError;
    }

    const exclusions = new Set(
      (body.excludePairs ?? []).map(
        (dish) => `${dish.dining_hall_id}::${dish.dish_name}`,
      ),
    );

    const candidates = (dishes ?? [])
      .filter(
        (dish) =>
          count !== 1 ||
          !exclusions.has(`${dish.dining_hall_id}::${dish.name}`),
      )
      .map((dish) => ({
        dish_name: dish.name,
        dining_hall_id: dish.dining_hall_id,
        dining_hall_name: hallNameById.get(dish.dining_hall_id) ?? "",
        nutrition_info: dish.nutrition_info,
        elo_rating: dish.elo_rating,
      }));

    shuffleInPlace(candidates);

    if (candidates.length < count) {
      throw new HttpError(400, `Failed to get ${count} random meals.`);
    }

    return jsonResponse({ meals: candidates.slice(0, count) });
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});
