import type {
  DiningHallOption,
  DishInfo,
  RandomMealsResponse,
} from "./types/meals";
import type { EloPatchBody, EloUpdateResponse } from "./types/elo";
import type { LeaderboardEntry, LeaderboardTab } from "./types/leaderboard";
import { supabase } from "./utils/supabase";

type FunctionErrorWithContext = Error & {
  context?: Response;
};

/** Maps a `DishInfo` from the UI to the PATCH /meals/elo dish object (backend `DishBody`). */
function dishToEloPayload(dish: DishInfo): EloPatchBody["winner"] {
  return {
    name: dish.dish_name,
    dining_hall_id: dish.dining_hall_id,
  };
}

async function readResponseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as { detail?: unknown }) : null;
    if (parsed && typeof parsed.detail === "string") return parsed.detail;
    if (parsed && Array.isArray(parsed.detail))
      return JSON.stringify(parsed.detail);
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function readFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === "object") {
    const context = (error as FunctionErrorWithContext).context;
    if (context instanceof Response) {
      return readResponseError(context);
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Request failed";
}

async function invokeFunction<TResponse>(
  functionName: string,
  body?: string | Record<string, unknown> | Array<unknown>,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    throw new Error(await readFunctionError(error));
  }

  return data as TResponse;
}

// ====================== ENDPOINTS ================================
export async function fetchDiningHalls(): Promise<DiningHallOption[]> {
  return invokeFunction<DiningHallOption[]>("dining-halls");
}

/**
 * Fetch random meals from the Supabase Edge Function.
 */
export async function fetchRandomMeals(
  count: 1 | 2,
  filterDiningHalls: string[],
  excludePairs?: DishInfo[],
): Promise<DishInfo[]> {
  const data = await invokeFunction<RandomMealsResponse>("random-meals", {
    count,
    filterDiningHalls,
    excludePairs,
  });
  return data.meals;
}

export async function patchMealElo(
  winner: DishInfo,
  loser: DishInfo,
  draw: boolean,
): Promise<EloUpdateResponse> {
  const body: EloPatchBody = {
    winner: dishToEloPayload(winner),
    loser: dishToEloPayload(loser),
    draw,
  };

  return invokeFunction<EloUpdateResponse>("update-elo", body);
}

type DiningHallRow = {
  id: string;
  name: string;
};

type DishLeaderboardRow = {
  name: string;
  dining_hall_id: string;
  elo_rating: number;
};

export async function refetchTopDishes(
  selectedTab: LeaderboardTab,
): Promise<LeaderboardEntry[]> {
  const { data: halls, error: hallsError } = await supabase
    .from("dining_halls")
    .select("id, name")
    .returns<DiningHallRow[]>();

  if (hallsError) throw hallsError;

  const hallNameById = new Map(
    (halls ?? []).map((hall) => [hall.id, hall.name]),
  );

  let query = supabase
    .from("dishes")
    .select("name, dining_hall_id, elo_rating")
    .order("elo_rating", { ascending: false })
    .order("name", { ascending: true })
    .limit(100);

  if (selectedTab.scope === "dining_hall") {
    query = query.eq("dining_hall_id", selectedTab.diningHallId);
  }

  const { data, error } = await query.returns<DishLeaderboardRow[]>();

  if (error) throw error;

  return (data ?? []).map((dish) => ({
    name: dish.name,
    dining_hall_id: dish.dining_hall_id,
    dining_hall_name: hallNameById.get(dish.dining_hall_id) ?? "",
    elo: dish.elo_rating,
  }));
}
