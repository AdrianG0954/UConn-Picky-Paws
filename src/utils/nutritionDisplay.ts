/** Canonical order for nutrition facts (FDA-style flow). Unknown keys sort after, alphabetically. */
const NUTRITION_KEY_ORDER: readonly string[] = [
  "serving_size",
  "calories",
  "allergens",
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
  "total_carbohydrate",
  "dietary_fiber",
  "total_sugars",
  "added_sugars",
  "protein",
  "vitamin_d",
  "calcium",
  "iron",
  "potassium",
];

const ORDER_INDEX = new Map(
  NUTRITION_KEY_ORDER.map((key, i) => [key, i] as const),
);

/** Sub-nutrients shown indented under Total Fat / Total Carbohydrate. */
const INDENT_KEYS = new Set([
  "saturated_fat",
  "trans_fat",
  "dietary_fiber",
  "total_sugars",
  "added_sugars",
]);

function titleCaseWord(word: string): string {
  if (word.length === 1) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function formatNutritionKey(key: string): string {
  return key.split("_").map(titleCaseWord).join(" ");
}

export function getNutritionKeyIndent(key: string): number {
  return INDENT_KEYS.has(key) ? 1 : 0;
}

export function sortNutritionEntries(
  entries: [string, unknown][],
): [string, unknown][] {
  const unknownRank = NUTRITION_KEY_ORDER.length;
  return [...entries].sort(([a], [b]) => {
    const ia = ORDER_INDEX.has(a) ? ORDER_INDEX.get(a)! : unknownRank;
    const ib = ORDER_INDEX.has(b) ? ORDER_INDEX.get(b)! : unknownRank;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}

export function isAmountDailyValue(
  value: unknown,
): value is { amount: string; daily_value: string } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return typeof o.amount === "string" && typeof o.daily_value === "string";
}

export function isAllergenList(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((x) => typeof x === "string")
  );
}

/** Full-width rows above the two-column macronutrient grid. */
export const NUTRITION_PREAMBLE_KEYS: readonly string[] = [
  "serving_size",
  "calories",
  "allergens",
];

/** Left column: fat family, then cholesterol and sodium. */
export const NUTRITION_LEFT_COLUMN_KEYS: readonly string[] = [
  "total_fat",
  "saturated_fat",
  "trans_fat",
  "cholesterol",
  "sodium",
];

/** Right column: carbohydrate family and protein. */
export const NUTRITION_RIGHT_COLUMN_KEYS: readonly string[] = [
  "total_carbohydrate",
  "dietary_fiber",
  "total_sugars",
  "added_sugars",
  "protein",
];

/** Bottom band: micronutrients (order: Vitamin D, iron, calcium, potassium). */
export const NUTRITION_MICRO_KEYS: readonly string[] = [
  "vitamin_d",
  "iron",
  "calcium",
  "potassium",
];

const GROUPED_KEYS = new Set<string>([
  ...NUTRITION_PREAMBLE_KEYS,
  ...NUTRITION_LEFT_COLUMN_KEYS,
  ...NUTRITION_RIGHT_COLUMN_KEYS,
  ...NUTRITION_MICRO_KEYS,
]);

export type NutritionGrouped = {
  preamble: [string, unknown][];
  leftColumn: [string, unknown][];
  rightColumn: [string, unknown][];
  micros: [string, unknown][];
  /** Keys not in the layout (rendered full-width below micros). */
  extra: [string, unknown][];
};

function pickKeys(
  map: Map<string, unknown>,
  keys: readonly string[],
): [string, unknown][] {
  return keys.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]);
}

/**
 * Splits flat nutrition entries into preamble, two macronutrient columns,
 * micronutrient band, and any unknown keys.
 */
export function groupNutritionEntries(
  entries: [string, unknown][],
): NutritionGrouped {
  const map = new Map(entries);
  const preamble = pickKeys(map, NUTRITION_PREAMBLE_KEYS);
  const leftColumn = pickKeys(map, NUTRITION_LEFT_COLUMN_KEYS);
  const rightColumn = pickKeys(map, NUTRITION_RIGHT_COLUMN_KEYS);
  const micros = pickKeys(map, NUTRITION_MICRO_KEYS);
  const extra = entries
    .filter(([k]) => !GROUPED_KEYS.has(k))
    .sort(([a], [b]) => a.localeCompare(b));
  return { preamble, leftColumn, rightColumn, micros, extra };
}
