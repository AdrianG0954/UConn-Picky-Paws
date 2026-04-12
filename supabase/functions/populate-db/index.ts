import "@supabase/functions-js/edge-runtime.d.ts";

import {
  errorResponse,
  handleOptions,
  jsonResponse,
  toHttpError,
} from "../_shared/http.ts";
import { DINING_HALL_KEYS, DINING_HALLS } from "../_shared/dining-halls.ts";
import {
  fetchDiningHallMenuWithNutritionalInfo,
  normalizedDiningHallName,
} from "../_shared/nutrition.ts";
import { getServiceRoleClient } from "../_shared/supabase.ts";

type DiningHallInsertRow = {
  id: string;
  req_id: string;
  name: string;
};

type DishInsertRow = {
  dining_hall_id: string;
  name: string;
  nutrition_info: Record<string, unknown>;
  elo_rating: number;
};

type HallSummary = {
  hall: string;
  attempted_dishes: number;
  unique_dishes: number;
  status: "ok" | "error";
  error?: string;
};

const HALL_CONCURRENCY = 3;
const DISH_INSERT_CHUNK_SIZE = 500;

// Here so one request does not try to send a huge payload at once
function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = [];
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    }),
  );

  return results;
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
    const supabase = getServiceRoleClient();
    console.log("populate-db: starting refresh");
    const { error: clearDishesError } = await supabase
      .from("dishes")
      .delete()
      .not("name", "is", null); // need filter to bypass

    if (clearDishesError) {
      console.error("populate-db: failed clearing dishes", clearDishesError);
      throw clearDishesError;
    }

    console.log("populate-db: cleared dishes table");

    const summaries = await runWithConcurrency(
      DINING_HALL_KEYS,
      HALL_CONCURRENCY,
      async (hallKey): Promise<HallSummary> => {
        try {
          const diningHallName = normalizedDiningHallName(hallKey);
          console.log(`populate-db: processing hall=${diningHallName}`);
          const { data: insertedHall, error: insertHallError } = await supabase
            .from("dining_halls")
            .upsert(
              {
                req_id: DINING_HALLS[hallKey],
                name: diningHallName,
              },
              {
                onConflict: "req_id",
                ignoreDuplicates: true,
              },
            )
            .select("id, req_id, name")
            .maybeSingle<DiningHallInsertRow>();

          if (insertHallError) {
            console.error(
              `populate-db: failed upserting hall=${diningHallName}`,
              insertHallError,
            );
            throw insertHallError;
          }

          let ensuredHall = insertedHall;
          if (!ensuredHall) {
            const { data: existingHall, error: existingHallError } = await supabase
              .from("dining_halls")
              .select("id, req_id, name")
              .eq("name", diningHallName)
              .maybeSingle<DiningHallInsertRow>();

            if (existingHallError || !existingHall) {
              console.error(
                `populate-db: failed loading existing hall=${diningHallName}`,
                existingHallError,
              );
              throw existingHallError ?? new Error(
                `Dining hall '${diningHallName}' not found`,
              );
            }

            ensuredHall = existingHall;
          }

          const menus = await fetchDiningHallMenuWithNutritionalInfo(
            hallKey,
            null,
          );
          const dishMap = new Map<string, DishInsertRow>();
          for (const dish of Object.values(menus).flatMap((mealDishes) => mealDishes)) {
            const key = `${ensuredHall.id}::${dish.name}`;
            if (dishMap.has(key)) {
              continue;
            }

            dishMap.set(key, {
              dining_hall_id: ensuredHall.id,
              name: dish.name,
              nutrition_info: dish.nutrition_facts,
              elo_rating: 1000.0,
            });
          }
          const dishes = Array.from(dishMap.values());

          for (const chunk of splitIntoChunks(dishes, DISH_INSERT_CHUNK_SIZE)) {
            if (chunk.length === 0) {
              continue;
            }

            const { error } = await supabase
              .from("dishes")
              .upsert(chunk, {
                onConflict: "dining_hall_id,name",
                ignoreDuplicates: true,
              });

            if (error) {
              console.error(
                `populate-db: failed inserting dishes hall=${diningHallName}`,
                error,
              );
              throw error;
            }
          }

          const attemptedDishes = Object.values(menus).flatMap((mealDishes) => mealDishes)
            .length;
          console.log(
            `populate-db: completed hall=${diningHallName} attempted=${attemptedDishes} unique=${dishes.length}`,
          );

          return {
            hall: diningHallName,
            attempted_dishes: attemptedDishes,
            unique_dishes: dishes.length,
            status: "ok",
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`populate-db: hall failed hall=${hallKey}`, error);
          return {
            hall: normalizedDiningHallName(hallKey),
            attempted_dishes: 0,
            unique_dishes: 0,
            status: "error",
            error: message,
          };
        }
      },
    );

    const processedHalls = summaries.filter((summary) => summary.status === "ok");
    const failedHalls = summaries.filter((summary) => summary.status === "error");
    const attemptedDishes = summaries.reduce(
      (sum, summary) => sum + summary.attempted_dishes,
      0,
    );

    console.log(
      `populate-db: finished processed=${processedHalls.length} failed=${failedHalls.length} attempted=${attemptedDishes}`,
    );

    return jsonResponse({
      processed_halls: processedHalls.length,
      failed_halls: failedHalls.length,
      attempted_dishes: attemptedDishes,
      halls: summaries,
    });
  } catch (error) {
    const httpError = toHttpError(error);
    console.error("populate-db: fatal error", error);
    return errorResponse(httpError.status, httpError.message, httpError.detail);
  }
});
