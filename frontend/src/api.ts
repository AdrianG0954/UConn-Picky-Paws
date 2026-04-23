import type {
  DiningHallOption,
  DishAvailabilityResponse,
  DishInfo,
  RandomMealsResponse,
} from "./types/meals";
import type { EloPatchBody, EloUpdateResponse } from "./types/elo";
import { getAccessToken } from "./auth/session";

export const API_PREFIX = "/api"; 

/** Headers for routes that require `Authorization: Bearer` (same JWT as after CAS callback). */
export function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h["Content-Type"] = "application/json";
  const token = getAccessToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Backend returns `Success: <jwt>` after CAS validates the ticket. */
export type CasCallbackResult =
  | { ok: true; accessToken: string }
  | { ok: false };

// CAS tickets are usually single-use; dedupe so React StrictMode does not issue two GET /callback calls for one ticket.
const casCallbackInflight = new Map<string, Promise<CasCallbackResult>>();

/**
 * Calls FastAPI GET `/callback` with the ticket. UConn `serviceValidate` runs only on the server (`main.callback`).
 */
export function fetchCasCallback(ticket: string): Promise<CasCallbackResult> {
  const hit = casCallbackInflight.get(ticket);
  if (hit) return hit;

  const promise = (async (): Promise<CasCallbackResult> => {
    const res = await fetch(
      `${API_PREFIX}/callback?${new URLSearchParams({ ticket })}`,
      {
        headers: authHeaders(),
      },
    );
    if (!res.ok) return { ok: false };
    const body = await res.text();
    if (!body.startsWith("Success:")) return { ok: false };
    const accessToken = body.slice("Success:".length).trim();
    if (!accessToken) return { ok: false };
    return { ok: true, accessToken };
  })().finally(() => {
    casCallbackInflight.delete(ticket);
  });

  casCallbackInflight.set(ticket, promise);
  return promise;
}

/** Maps a `DishInfo` from the UI to the PATCH /meals/elo dish object (backend `DishBody`). */
function dishToEloPayload(dish: DishInfo): EloPatchBody["winner"] {
  return {
    name: dish.dish_name,
    dining_hall_id: dish.dining_hall_id,
  };
}

async function readError(res: Response): Promise<string> {
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

export async function fetchDiningHalls(): Promise<DiningHallOption[]> {
  const res = await fetch(`${API_PREFIX}/dining-halls`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DiningHallOption[];
}

/**
 * GET /meals/random. Backend expects repeated `filter_dining_halls` query params
 * (one per hall name). With count 1, `excludePairs` becomes parallel exclude_* params.
 */
export async function fetchRandomMeals(
  count: 1 | 2,
  filterDiningHalls: string[],
  excludePairs?: DishInfo[],
): Promise<DishInfo[]> {
  const params = new URLSearchParams({ count: String(count) });
  for (const name of filterDiningHalls) {
    params.append("filter_dining_halls", name);
  }
  if (excludePairs?.length) {
    for (const d of excludePairs) {
      params.append("exclude_names", d.dish_name);
      params.append("exclude_dining_hall_ids", d.dining_hall_id);
    }
  }

  const res = await fetch(`${API_PREFIX}/meals/random?${params.toString()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res));

  const data = (await res.json()) as RandomMealsResponse;
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

  const res = await fetch(`${API_PREFIX}/meals/elo`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as EloUpdateResponse;
}

export async function fetchMealAvailability(
  foodItem: string,
  hallName: string,
): Promise<DishAvailabilityResponse> {
  const params = new URLSearchParams({
    dish_name: foodItem,
    hall_name: hallName,
  });
  const res = await fetch(
    `${API_PREFIX}/meals/availability?${params.toString()}`,
    {
      headers: authHeaders(),
    },
  );

  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as DishAvailabilityResponse;
}
