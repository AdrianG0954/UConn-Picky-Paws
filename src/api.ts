import type {
  DiningHallOption,
  DishInfo,
  RandomMealsResponse,
} from "./types/meals";
import type { EloPatchBody, EloUpdateResponse } from "./types/elo";
import type { LeaderboardEntry, LeaderboardTab } from "./types/leaderboard";
import { clearAccessToken, getAccessToken } from "./auth/session";
import {
  getFunctionUrl,
  supabase,
  syncRealtimeAuth,
} from "./utils/supabase";

type FunctionErrorWithContext = Error & {
  context?: Response;
};

type CasCallbackResponse = {
  accessToken: string;
  user: {
    id: string;
    netid: string;
    email: string;
  };
};

/** Maps a `DishInfo` from the UI to the PATCH /meals/elo dish object (backend `DishBody`). */
function dishToEloPayload(dish: DishInfo): EloPatchBody["winner"] {
  return {
    name: dish.dish_name,
    dining_hall_id: dish.dining_hall_id,
  };
}

function isLikelyAuthError(message: string, status?: number): boolean {
  if (status === 401) {
    return true;
  }

  return /authorization|auth|jwt|token|row-level security|permission denied/i
    .test(message);
}

async function clearClientAuthState(): Promise<void> {
  clearAccessToken();
  await syncRealtimeAuth(null);
}

async function ensureAccessToken(): Promise<string> {
  const token = getAccessToken();
  if (!token) {
    await clearClientAuthState();
    throw new Error("Authentication required.");
  }

  return token;
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

async function readFunctionError(
  error: unknown,
): Promise<{ message: string; status?: number }> {
  if (error && typeof error === "object") {
    const context = (error as FunctionErrorWithContext).context;
    if (context instanceof Response) {
      return {
        message: await readResponseError(context),
        status: context.status,
      };
    }
  }

  if (error instanceof Error && error.message) {
    return {
      message: error.message,
    };
  }

  return {
    message: "Request failed",
  };
}

async function handlePossibleAuthFailure(
  message: string,
  status?: number,
): Promise<void> {
  if (isLikelyAuthError(message, status)) {
    await clearClientAuthState();
  }
}

async function invokeFunction<TResponse>(
  functionName: string,
  body?: string | Record<string, unknown> | Array<unknown>,
): Promise<TResponse> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
  });

  if (error) {
    const { message, status } = await readFunctionError(error);
    await handlePossibleAuthFailure(message, status);
    throw new Error(message);
  }

  return data as TResponse;
}

const DEV_CAS_CALLBACK_URL = "http://localhost:5173/callback";
const casCallbackInflight = new Map<string, Promise<CasCallbackResponse>>();

function getCasServiceUrl(): string {
  return import.meta.env.DEV
    ? DEV_CAS_CALLBACK_URL
    : `${window.location.origin}/callback`;
}

export function getCasLoginUrl(): string {
  const url = new URL('https://login.uconn.edu/cas/login');
  url.searchParams.set("service", getCasServiceUrl());
  return url.toString();
}

export async function fetchCasCallback(
  ticket: string,
): Promise<CasCallbackResponse> {

  // Check needed for strict mode
  const existing = casCallbackInflight.get(ticket);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    const response = await fetch(
      `${getFunctionUrl("cas-callback")}?${new URLSearchParams({ ticket })}`,
    );

    if (!response.ok) {
      const message = await readResponseError(response);
      await handlePossibleAuthFailure(message, response.status);
      throw new Error(message || "SSO sign in failed.");
    }

    const body = await response.json() as Partial<CasCallbackResponse>;
    if (
      typeof body.accessToken !== "string" ||
      !body.user ||
      typeof body.user.id !== "string" ||
      typeof body.user.netid !== "string" ||
      typeof body.user.email !== "string"
    ) {
      throw new Error("CAS callback returned an invalid session.");
    }
    return {
      accessToken: body.accessToken,
      user: body.user,
    };
  })().finally(() => {
    casCallbackInflight.delete(ticket);
  });

  casCallbackInflight.set(ticket, request);
  return request;
}

// ====================== ENDPOINTS ================================
export async function fetchDiningHalls(): Promise<DiningHallOption[]> {
  await ensureAccessToken();
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
  await ensureAccessToken();
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
  await ensureAccessToken();
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
  await ensureAccessToken();
  const { data: halls, error: hallsError } = await supabase
    .from("dining_halls")
    .select("id, name")
    .overrideTypes<DiningHallRow[]>();

  if (hallsError) {
    await handlePossibleAuthFailure(hallsError.message);
    throw new Error(hallsError.message);
  }

  const hallNameById = new Map(
    (halls ?? []).map((hall) => [hall.id, hall.name]),
  );

  let query = supabase
    .from("dishes")
    .select("name, dining_hall_id, elo_rating")
    .order("elo_rating", { ascending: false })
    .order("name", { ascending: true })
    .limit(10);

  if (selectedTab.scope === "dining_hall") {
    query = query.eq("dining_hall_id", selectedTab.diningHallId);
  }

  const { data, error } = await query.overrideTypes<DishLeaderboardRow[]>();

  if (error) {
    await handlePossibleAuthFailure(error.message);
    throw new Error(error.message);
  }

  return (data ?? []).map((dish) => ({
    name: dish.name,
    dining_hall_id: dish.dining_hall_id,
    dining_hall_name: hallNameById.get(dish.dining_hall_id) ?? "",
    elo: dish.elo_rating,
  }));
}
