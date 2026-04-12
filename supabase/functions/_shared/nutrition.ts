import { parse } from "node-html-parser";
import { DINING_HALLS } from "./dining-halls.ts";

type NutritionFacts = {
  serving_size: string;
  calories: number;
  allergens: string[];
  [key: string]: unknown;
};

export type ParsedMealItem = {
  name: string;
  nutrition_facts: NutritionFacts;
};

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"] as const;
const REPLACE_WITH_COCONUT =
  "Our bakery uses coconut (a tree nut).";

class Semaphore {
  #available: number;
  #queue: Array<() => void> = [];

  constructor(size: number) {
    this.#available = size;
  }

  async withPermit<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.#available > 0) {
      this.#available -= 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.#queue.push(() => {
        this.#available -= 1;
        resolve();
      });
    });
  }

  private release() {
    this.#available += 1;
    const next = this.#queue.shift();
    if (next) {
      next();
    }
  }
}

const nutritionSemaphore = new Semaphore(10);

export function normalizedDiningHallName(
  hallKey: keyof typeof DINING_HALLS,
): string {
  return hallKey.toLowerCase().replace(/_/g, " ");
}

export async function fetchDiningHallMenuWithNutritionalInfo(
  hallKey: keyof typeof DINING_HALLS,
  dtdate?: string | null,
): Promise<Record<string, ParsedMealItem[]>> {
  const locationNum = DINING_HALLS[hallKey];
  const foodItems: Record<string, ParsedMealItem[]> = {};

  await Promise.all(
    MEAL_TYPES.map(async (mealType) => {
      const params = new URLSearchParams({
        sName: "UCONN Dining Services",
        locationNum,
        naFlag: "1",
        mealName: mealType,
      });

      if (dtdate) {
        params.set("dtdate", dtdate);
      }

      try {
        const response = await nutritionSemaphore.withPermit(() =>
          fetch(
            `https://nutritionanalysis.dds.uconn.edu/longmenu.aspx?${params.toString()}`,
          )
        );

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const html = await response.text();
        foodItems[mealType] = await fetchNutritionalInfoAndParse(html);
      } catch (error) {
        console.warn(`Error fetching ${hallKey} ${mealType}`, error);
        foodItems[mealType] = [];
      }
    }),
  );

  return foodItems;
}

async function fetchNutritionalInfoAndParse(
  html: string,
): Promise<ParsedMealItem[]> {
  if (!html) {
    return [];
  }

  const items = html
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("longmenucoldispname"));

  const results = await Promise.allSettled(
    items.map(async (line) => {
      const dishPath = extractDishPath(line);
      if (!dishPath) {
        return null;
      }

      const url = new URL(
        dishPath,
        "https://nutritionanalysis.dds.uconn.edu/",
      );

      try {
        const response = await nutritionSemaphore.withPermit(() =>
          fetch(url.toString())
        );
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const parsed = parseMealItem(await response.text());
        return parsed.name === "Unknown" ? null : parsed;
      } catch (error) {
        console.warn(`Error fetching ${url}`, error);
        return null;
      }
    }),
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value ? [result.value] : []
  );
}

function extractDishPath(line: string): string | null {
  const singleQuoteParts = line.split("'", 8);
  if (singleQuoteParts.length >= 8) {
    const candidate = singleQuoteParts[7]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const hrefMatch = line.match(/href=['"]([^'"]+)['"]/i);
  if (hrefMatch?.[1]) {
    return hrefMatch[1];
  }

  return null;
}

export function parseMealItem(html: string): ParsedMealItem {
  if (!html) {
    return { name: "Unknown", nutrition_facts: emptyNutritionFacts() };
  }

  const root = parse(html);

  if (root.querySelector(".labelnotavailable")) {
    return { name: "Unknown", nutrition_facts: emptyNutritionFacts() };
  }

  const name = textOf(root.querySelector(".labelrecipe")) || "Unknown";
  const servingSizes = root.querySelectorAll(".nutfactsservsize").map(textOf)
    .filter((value): value is string => Boolean(value));
  const servingSize = servingSizes[1]?.toLowerCase() ?? "Unknown";
  const caloriesText = textOf(root.querySelector(".nutfactscaloriesval"));
  const allergensText = textOf(root.querySelector(".labelallergensvalue"));

  const nutritionFacts: NutritionFacts = {
    serving_size: servingSize,
    calories: caloriesText ? Number.parseInt(caloriesText, 10) || 0 : 0,
    allergens: allergensText
      ? allergensText.replace(REPLACE_WITH_COCONUT, "Coconut").split(", ")
      : [],
  };

  const nutrients = root.querySelectorAll(".nutfactstopnutrient").map((node) =>
    textOf(node)?.replaceAll("\xa0", "").trim() ?? ""
  );
  for (let index = 0; index < nutrients.length; index += 2) {
    const nutrient = nutrients[index]?.trim();
    const dailyValue = nutrients[index + 1]?.trim() ?? "";
    if (!nutrient) {
      continue;
    }

    const key = normalizeNutrient(nutrient);
    const nutrientTokens = nutrient.split(/\s+/);
    const grams = nutrient.includes("Added Sugars")
      ? nutrientTokens[1] ?? "0g"
      : nutrientTokens[nutrientTokens.length - 1] ?? "0g";

    nutritionFacts[key] = buildNutrientValue(nutrient, grams, dailyValue);
  }

  return {
    name,
    nutrition_facts: nutritionFacts,
  };
}

function buildNutrientValue(
  nutrient: string,
  grams: string,
  dailyValue: string,
) {
  const hasMeasuredAmount = /\d/.test(grams);

  if (nutrient.includes("Trans Fat")) {
    return {
      amount: hasMeasuredAmount ? grams : "0g",
      daily_value: "0%",
    };
  }

  if (nutrient.includes("Vitamin D")) {
    return {
      amount: hasMeasuredAmount ? grams : "0mcg",
      daily_value: dailyValue || "0%",
    };
  }

  if (nutrient.includes("Potassium")) {
    return {
      amount: hasMeasuredAmount ? grams : "0mg",
      daily_value: dailyValue || "0%",
    };
  }

  if (nutrient.includes("Total Sugars")) {
    return {
      amount: grams,
      daily_value: hasMeasuredAmount
        ? `${Math.round((Number.parseFloat(grams.replace("g", "")) / 50) * 100)}%`
        : "~%",
    };
  }

  if (nutrient.includes("Protein")) {
    return {
      amount: grams,
      daily_value: hasMeasuredAmount
        ? `${Math.round(((Number.parseFloat(grams.replace("g", "")) * 0.415) / 50) * 100)}%`
        : "~%",
    };
  }

  return {
    amount: grams,
    daily_value: dailyValue,
  };
}

function normalizeNutrient(nutrient: string): string {
  const tokens = nutrient.split(/\s+/);
  const oneNormal = `${tokens[0]?.toLowerCase() ?? ""}`;
  const twoNormal =
    `${tokens[0]?.toLowerCase() ?? ""}_${tokens[1]?.toLowerCase().replace(".", "") ?? ""}`;
  const oneList = new Set([
    "cholesterol",
    "sodium",
    "protein",
    "calcium",
    "iron",
    "potassium",
  ]);
  const twoList = new Set([
    "total_fat",
    "total_carbohydrate",
    "saturated_fat",
    "dietary_fiber",
    "trans_fat",
    "total_sugars",
    "vitamin_d",
  ]);

  if (oneList.has(oneNormal)) {
    return oneNormal;
  }
  if (twoList.has(twoNormal)) {
    return twoNormal;
  }
  return "added_sugars";
}

function textOf(
  node: { text: string } | null | undefined,
): string | null {
  const value = node?.text?.trim();
  return value ? value : null;
}

function emptyNutritionFacts(): NutritionFacts {
  return {
    serving_size: "Unknown",
    calories: 0,
    allergens: [],
  };
}
