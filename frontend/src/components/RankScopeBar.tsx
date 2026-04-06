/**
 * Compact toolbar: All vs Selected halls, optional checkboxes, Apply to commit scope.
 */
import type { DiningHallOption } from "../types/meals";
import type { RankScopeMode } from "../types/rankScope";

/** Caps vertical growth when there are many halls; scroll inside the chip list. */
const HALL_CHIP_LIST_CLASS =
  "flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto overscroll-contain pr-0.5 md:max-h-[6.5rem]";

export type RankScopeBarProps = {
  hallOptions: DiningHallOption[];
  filterMode: RankScopeMode;
  onFilterModeChange: (mode: RankScopeMode) => void;
  subsetIds: Set<string>;
  onToggleHall: (id: string) => void;
  onSelectAllSubset: () => void;
  onClearSubset: () => void;
  busy: boolean;
  applyDisabled: boolean;
  onApply: () => void;
};

export function RankScopeBar({
  hallOptions,
  filterMode,
  onFilterModeChange,
  subsetIds,
  onToggleHall,
  onSelectAllSubset,
  onClearSubset,
  busy,
  applyDisabled,
  onApply,
}: RankScopeBarProps) {
  return (
    <section
      className="mb-4 rounded-lg border border-zinc-200 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm md:mb-5"
      aria-labelledby="rank-scope-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2
            id="rank-scope-heading"
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-uconn-navy"
          >
            Halls
          </h2>
          <fieldset className="m-0 flex flex-wrap items-center gap-3 border-0 p-0">
            <legend className="sr-only">Dining hall scope</legend>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-800">
              <input
                type="radio"
                name="rank-scope"
                checked={filterMode === "all"}
                onChange={() => onFilterModeChange("all")}
                disabled={busy}
              />
              All
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-800">
              <input
                type="radio"
                name="rank-scope"
                checked={filterMode === "subset"}
                onChange={() => onFilterModeChange("subset")}
                disabled={busy}
              />
              Selected
            </label>
          </fieldset>
        </div>
        <button
          type="button"
          disabled={applyDisabled}
          onClick={onApply}
          className="shrink-0 rounded-md bg-uconn-navy px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-uconn-navy-dark disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          Apply
        </button>
      </div>

      {filterMode === "subset" ? (
        <div className="mt-2 border-t border-zinc-100 pt-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <button
              type="button"
              onClick={onSelectAllSubset}
              disabled={busy}
              className="font-medium text-uconn-navy underline-offset-2 hover:underline disabled:opacity-50"
            >
              Select all
            </button>
            <span className="select-none text-zinc-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={onClearSubset}
              disabled={busy}
              className="font-medium text-uconn-navy underline-offset-2 hover:underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
          <ul className={HALL_CHIP_LIST_CLASS}>
            {hallOptions.map((h) => (
              <li key={h.id}>
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-800 hover:border-uconn-navy/25">
                  <input
                    type="checkbox"
                    checked={subsetIds.has(h.id)}
                    onChange={() => onToggleHall(h.id)}
                    disabled={busy}
                  />
                  {h.name}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
