import { useEffect } from "react";
import type { DishInfo } from "../types/meals";

type Props = {
  dish: DishInfo | null;
  onClose: () => void;
};

export function NutritionModal({ dish, onClose }: Props) {
  useEffect(() => {
    if (!dish) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dish, onClose]);

  if (!dish) return null;

  const entries = Object.entries(dish.nutrition_info);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="nutrition-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2
              id="nutrition-title"
              className="text-lg font-semibold text-uconn-navy"
            >
              Nutrition — {dish.dish_name}
            </h2>
            <p className="text-sm text-zinc-500">{dish.dining_hall_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-uconn-navy hover:bg-uconn-navy/10"
          >
            Close
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No nutrition data.</p>
        ) : (
          <dl className="grid gap-2 text-sm">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between gap-4 border-b border-zinc-100 py-2 last:border-0"
              >
                <dt className="font-medium text-zinc-700">{key}</dt>
                <dd className="text-right text-zinc-600">
                  {formatNutritionValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

function formatNutritionValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
