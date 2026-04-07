import { useEffect, useMemo } from "react";
import type { DishInfo } from "../types/meals";
import {
  formatNutritionKey,
  getNutritionKeyIndent,
  groupNutritionEntries,
  isAllergenList,
  isAmountDailyValue,
  sortNutritionEntries,
} from "../utils/nutritionDisplay";

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

  const grouped = useMemo(() => {
    if (!dish) return null;
    const sorted = sortNutritionEntries(Object.entries(dish.nutrition_info));
    return groupNutritionEntries(sorted);
  }, [dish]);

  if (!dish) return null;

  const hasAny =
    grouped &&
    (grouped.preamble.length > 0 ||
      grouped.leftColumn.length > 0 ||
      grouped.rightColumn.length > 0 ||
      grouped.micros.length > 0 ||
      grouped.extra.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl"
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
        {!hasAny || !grouped ? (
          <p className="text-sm text-zinc-500">No nutrition data.</p>
        ) : (
          <div>
            {grouped.preamble.length > 0 ? (
              <div className="mb-4 text-sm">
                {grouped.preamble.map(([key, value]) => (
                  <PreambleRow key={key} entryKey={key} value={value} />
                ))}
              </div>
            ) : null}

            {(grouped.leftColumn.length > 0 || grouped.rightColumn.length > 0) && (
              <div className="grid grid-cols-1 gap-6 border-t border-zinc-200 pt-4 sm:grid-cols-2 sm:gap-8">
                <NutrientColumn entries={grouped.leftColumn} />
                <NutrientColumn
                  entries={grouped.rightColumn}
                  className="sm:border-l sm:border-zinc-200 sm:pl-8"
                />
              </div>
            )}

            {grouped.micros.length > 0 ? (
              <div className="mt-5 border-t border-zinc-200 pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Vitamins & minerals
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {grouped.micros.map(([key, value]) => (
                    <MicroTile key={key} entryKey={key} value={value} />
                  ))}
                </div>
              </div>
            ) : null}

            {grouped.extra.length > 0 ? (
              <ExtraSection entries={grouped.extra} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function AmountDvHeader() {
  return (
    <div
      className="flex items-baseline justify-between gap-2 border-b border-zinc-200 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
      aria-hidden="true"
    >
      <div className="min-w-0 flex-1" />
      <div className="flex shrink-0 gap-3">
        <span className="min-w-[3.75rem] text-right">Amount</span>
        <span className="w-12 text-right sm:w-14">%DV</span>
      </div>
    </div>
  );
}

type ColumnProps = {
  entries: [string, unknown][];
  className?: string;
};

function NutrientColumn({ entries, className = "" }: ColumnProps) {
  if (entries.length === 0) return null;
  return (
    <div className={`min-w-0 text-sm ${className}`}>
      <AmountDvHeader />
      {entries.map(([key, value]) => (
        <DvRow key={key} entryKey={key} value={value} />
      ))}
    </div>
  );
}

type RowProps = {
  entryKey: string;
  value: unknown;
};

function PreambleRow({ entryKey, value }: RowProps) {
  const label = formatNutritionKey(entryKey);

  if (value === null || value === undefined) {
    return (
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
        <div className="min-w-0 flex-1 font-medium text-zinc-700">{label}</div>
        <div className="shrink-0 text-right text-zinc-600">—</div>
      </div>
    );
  }

  if (entryKey === "allergens" && isAllergenList(value)) {
    return (
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2">
        <div className="min-w-0 flex-1 font-medium text-zinc-700">{label}</div>
        <div className="flex max-w-[min(100%,18rem)] flex-wrap justify-end gap-1.5">
          {value.length === 0 ? (
            <span className="text-zinc-500">—</span>
          ) : (
            value.map((a) => (
              <span
                key={a}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
              >
                {a}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
        <div className="min-w-0 flex-1 font-medium text-zinc-700">{label}</div>
        <div className="max-w-[60%] shrink-0 break-words text-right font-mono text-xs text-zinc-600">
          {JSON.stringify(value)}
        </div>
      </div>
    );
  }

  const display =
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.round(value))
      : String(value);

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
      <div className="min-w-0 flex-1 font-medium text-zinc-700">{label}</div>
      <div className="shrink-0 text-right text-zinc-600">{display}</div>
    </div>
  );
}

function DvRow({ entryKey, value }: RowProps) {
  const label = formatNutritionKey(entryKey);
  const indentClass = getNutritionKeyIndent(entryKey) ? "pl-3" : "";

  const labelCell = (
    <div className={`min-w-0 flex-1 font-medium text-zinc-700 ${indentClass}`}>
      {label}
    </div>
  );

  if (value === null || value === undefined) {
    return (
      <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 py-1.5">
        {labelCell}
        <div className="flex shrink-0 gap-3 text-zinc-600">
          <span className="min-w-[3.75rem] text-right">—</span>
          <span className="w-12 text-right sm:w-14">—</span>
        </div>
      </div>
    );
  }

  if (isAmountDailyValue(value)) {
    return (
      <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 py-1.5">
        {labelCell}
        <div className="flex shrink-0 gap-3 text-zinc-600">
          <span className="min-w-[3.75rem] text-right tabular-nums">
            {value.amount}
          </span>
          <span className="w-12 text-right tabular-nums sm:w-14">
            {value.daily_value}
          </span>
        </div>
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 py-1.5">
        {labelCell}
        <div className="max-w-[55%] shrink-0 break-words text-right font-mono text-xs text-zinc-600">
          {JSON.stringify(value)}
        </div>
      </div>
    );
  }

  const display =
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.round(value))
      : String(value);

  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-zinc-100 py-1.5">
      {labelCell}
      <div className="shrink-0 text-right text-zinc-600">{display}</div>
    </div>
  );
}

function MicroTile({ entryKey, value }: RowProps) {
  const label = formatNutritionKey(entryKey);

  if (isAmountDailyValue(value)) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-2.5 text-center sm:px-3">
        <div className="text-[11px] font-semibold leading-tight text-zinc-700 sm:text-xs">
          {label}
        </div>
        <div className="mt-1 text-sm font-semibold tabular-nums text-zinc-900">
          {value.amount}
        </div>
        <div className="text-[11px] tabular-nums text-zinc-500 sm:text-xs">
          {value.daily_value}
        </div>
      </div>
    );
  }

  if (value === null || value === undefined) {
    return (
      <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-2.5 text-center sm:px-3">
        <div className="text-[11px] font-semibold text-zinc-700 sm:text-xs">
          {label}
        </div>
        <div className="mt-1 text-sm text-zinc-500">—</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/90 px-2 py-2.5 text-center sm:px-3">
      <div className="text-[11px] font-semibold text-zinc-700 sm:text-xs">
        {label}
      </div>
      <div className="mt-1 break-words text-xs text-zinc-600">
        {typeof value === "object"
          ? JSON.stringify(value)
          : String(value)}
      </div>
    </div>
  );
}

function ExtraSection({ entries }: { entries: [string, unknown][] }) {
  const firstDv = entries.findIndex(([, v]) => isAmountDailyValue(v));
  return (
    <div className="mt-5 border-t border-zinc-200 pt-4 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Additional info
      </p>
      {entries.map(([key, value], index) => (
        <FragmentRow
          key={key}
          entryKey={key}
          value={value}
          showDvHeader={index === firstDv && firstDv >= 0}
        />
      ))}
    </div>
  );
}

type FragmentRowProps = RowProps & { showDvHeader: boolean };

function FragmentRow({ entryKey, value, showDvHeader }: FragmentRowProps) {
  const label = formatNutritionKey(entryKey);
  const indentClass = getNutritionKeyIndent(entryKey) ? "pl-3" : "";
  const labelCell = (
    <div className={`min-w-0 flex-1 font-medium text-zinc-700 ${indentClass}`}>
      {label}
    </div>
  );

  const headerRow = showDvHeader ? <AmountDvHeader /> : null;

  if (value === null || value === undefined) {
    return (
      <>
        {headerRow}
        <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
          {labelCell}
          <div className="shrink-0 text-right text-zinc-600">—</div>
        </div>
      </>
    );
  }

  if (isAmountDailyValue(value)) {
    return (
      <>
        {headerRow}
        <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
          {labelCell}
          <div className="flex shrink-0 gap-3 text-zinc-600">
            <span className="min-w-[3.75rem] text-right tabular-nums">
              {value.amount}
            </span>
            <span className="w-12 text-right tabular-nums sm:w-14">
              {value.daily_value}
            </span>
          </div>
        </div>
      </>
    );
  }

  if (entryKey === "allergens" && isAllergenList(value)) {
    return (
      <>
        {headerRow}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 py-2">
          <div className={`min-w-0 flex-1 font-medium text-zinc-700 ${indentClass}`}>
            {label}
          </div>
          <div className="flex max-w-[min(100%,14rem)] flex-wrap justify-end gap-1.5">
            {value.map((a) => (
              <span
                key={a}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (typeof value === "object") {
    return (
      <>
        {headerRow}
        <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
          {labelCell}
          <div className="max-w-[60%] shrink-0 break-words text-right font-mono text-xs text-zinc-600">
            {JSON.stringify(value)}
          </div>
        </div>
      </>
    );
  }

  const display =
    typeof value === "number" && Number.isFinite(value)
      ? String(Math.round(value))
      : String(value);

  return (
    <>
      {headerRow}
      <div className="flex items-baseline justify-between gap-4 border-b border-zinc-100 py-2">
        {labelCell}
        <div className="shrink-0 text-right text-zinc-600">{display}</div>
      </div>
    </>
  );
}
