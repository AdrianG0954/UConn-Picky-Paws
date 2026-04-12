import { HttpError } from "./http.ts";

export const DINING_HALLS = {
  CONNECTICUT: "03",
  NORTH: "07",
  PUTNAM: "06",
  NORTHWEST: "15",
  WHITNEY: "01",
  MCMAHON: "05",
  SOUTH: "16",
  TOWERS: "42",
} as const;

export const DINING_HALL_KEYS = Object.keys(DINING_HALLS) as Array<
  keyof typeof DINING_HALLS
>;

export function getDiningHallInfo(rawHallName: string) {
  const hallKey = rawHallName.trim().toUpperCase().replace(/ /g, "_");
  const locationNum = DINING_HALLS[hallKey as keyof typeof DINING_HALLS];

  if (!locationNum) {
    throw new HttpError(404, `Dining hall '${rawHallName}' not found`);
  }

  return {
    locationNum,
    hallName: hallKey.toLowerCase().replace(/_/g, " "),
  };
}

export function parseFoodItems(html: string): Record<string, string[]> {
  const response: Record<string, string[]> = {};
  if (!html) {
    return response;
  }

  const breakfast = '<div class="shortmenumeals">Breakfast</div>';
  const lunch = '<div class="shortmenumeals">Lunch</div>';
  const dinner = '<div class="shortmenumeals">Dinner</div>';
  const itemMarker = "<div class='shortmenurecipes'>";

  response.breakfast = parseMealSection(html, breakfast, lunch, itemMarker);
  response.lunch = parseMealSection(html, lunch, dinner, itemMarker);
  response.dinner = parseMealSection(html, dinner, null, itemMarker);

  return response;
}

function parseMealSection(
  html: string,
  mealMarker: string,
  nextMealMarker: string | null,
  itemMarker: string,
): string[] {
  const items: string[] = [];
  const components = html.split(mealMarker).slice(1);

  for (const component of components) {
    for (const candidate of component.split(itemMarker)) {
      const name = candidate.split("&nbsp;", 1)[0]?.trim().split(">").at(-1)
        ?.trim();
      if (name) {
        items.push(name);
      }

      if (nextMealMarker && candidate.includes(nextMealMarker)) {
        break;
      }
    }
  }

  return items;
}
