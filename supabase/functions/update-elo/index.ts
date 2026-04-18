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

type DishBody = {
  dining_hall_id?: string;
  d_id?: string;
  name: string;
};

type EloBody = {
  winner: DishBody;
  loser: DishBody;
  draw: boolean;
};

type DishEloRow = {
  elo_rating: number;
};

const K_FACTOR = 30;

function calculateProbability(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (a - b) / 400));
}

function getDishIdentity(dish: DishBody, role: "winner" | "loser") {
  const diningHallId = dish.dining_hall_id ?? dish.d_id;
  if (!diningHallId || !dish.name) {
    throw new HttpError(
      400,
      `${role} must include both name and dining_hall_id.`,
    );
  }

  return {
    diningHallId,
    name: dish.name,
  };
}

async function fetchElo(diningHallId: string, name: string): Promise<number> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("dishes")
    .select("elo_rating")
    .eq("dining_hall_id", diningHallId)
    .eq("name", name)
    .maybeSingle<DishEloRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new HttpError(
      400,
      `Elo rating not found for '${name}' in dining hall ${diningHallId}.`,
    );
  }

  return data.elo_rating;
}

async function updateElo(
  diningHallId: string,
  name: string,
  nextElo: number,
): Promise<void> {
  const supabase = getServiceRoleClient();
  const { error } = await supabase
    .from("dishes")
    .update({ elo_rating: nextElo })
    .eq("dining_hall_id", diningHallId)
    .eq("name", name);

  if (error) {
    throw error;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) {
    return preflight;
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
    return errorResponse(405, "Method not allowed.");
  }

  try {
    await requireAuthenticatedRequest(req);
    const body = await readJson<EloBody>(req);
    const winner = getDishIdentity(body.winner, "winner");
    const loser = getDishIdentity(body.loser, "loser");
    const outcome = body.draw ? 0.5 : 1;

    const loserElo = await fetchElo(loser.diningHallId, loser.name);
    const winnerElo = await fetchElo(winner.diningHallId, winner.name);

    const winnerProbability = calculateProbability(loserElo, winnerElo);
    const loserProbability = calculateProbability(winnerElo, loserElo);

    const winnerNewElo = winnerElo + K_FACTOR * (outcome - winnerProbability);
    const loserNewElo = loserElo + K_FACTOR * (1 - outcome - loserProbability);

    await updateElo(winner.diningHallId, winner.name, winnerNewElo);
    try {
      await updateElo(loser.diningHallId, loser.name, loserNewElo);
    } catch (error) {
      try {
        await updateElo(winner.diningHallId, winner.name, winnerElo);
      } catch (rollbackError) {
        console.error("Failed to roll back winner Elo update.", rollbackError);
      }
      throw error;
    }

    return jsonResponse({
      winner_new_elo: winnerNewElo,
      loser_new_elo: loserNewElo,
    });
  } catch (error) {
    const httpError = toHttpError(error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});
