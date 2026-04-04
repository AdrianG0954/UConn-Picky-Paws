import type { DiningHallOption, DishInfo, RandomMealsResponse } from './types/meals'
import type { EloPatchBody, EloUpdateResponse } from './types/elo'

/** HTTP client for the FastAPI backend (Vite proxies `/api` to the server in dev). */

const API_PREFIX = '/api'

/** Maps a `DishInfo` from the UI to the PATCH /meals/elo dish object (backend `DishBody`). */
function dishToEloPayload(dish: DishInfo): EloPatchBody['winner'] {
  return {
    name: dish.dish_name,
    dining_hall_id: dish.dining_hall_id,
    meal_type: dish.meal_type,
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    const parsed = text ? (JSON.parse(text) as { detail?: unknown }) : null
    if (parsed && typeof parsed.detail === 'string') return parsed.detail
    if (parsed && Array.isArray(parsed.detail)) return JSON.stringify(parsed.detail)
    return text || res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchDiningHalls(): Promise<DiningHallOption[]> {
  const res = await fetch(`${API_PREFIX}/dining-halls`)
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as DiningHallOption[]
}

/**
 * GET /meals/random — repeats exclude_names, exclude_dining_hall_ids, exclude_meal_types per backend contract.
 */
export async function fetchRandomMeals(
  count: 1 | 2,
  excludePairs?: DishInfo[],
): Promise<DishInfo[]> {
  const params = new URLSearchParams({ count: String(count) })
  if (excludePairs?.length) {
    for (const d of excludePairs) {
      params.append('exclude_names', d.dish_name)
      params.append('exclude_dining_hall_ids', d.dining_hall_id)
      params.append('exclude_meal_types', d.meal_type)
    }
  }

  const res = await fetch(`${API_PREFIX}/meals/random?${params.toString()}`)
  if (!res.ok) throw new Error(await readError(res))

  const data = (await res.json()) as RandomMealsResponse
  return data.meals
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
  }

  const res = await fetch(`${API_PREFIX}/meals/elo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as EloUpdateResponse
}
