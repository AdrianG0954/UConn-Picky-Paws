/**
 * Dining-hall scope for head-to-head: which hall names are sent as repeated
 * `filter_dining_halls` on GET /meals/random. “Draft” is what the UI shows;
 * “active” is what the page uses after Apply (and on first load = all halls).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDiningHalls } from "../api";
import type { DiningHallOption } from "../types/meals";
import type { HallsLoadStatus, RankScopeMode } from "../types/rankScope";
import { errorMessage } from "../utils/errorMessage";
import { sameHallNameSet } from "../utils/hallScope";

export type UseRankDiningHallScopeOptions = {
  /** When Apply is pressed with no halls selected in subset mode. */
  onApplyInvalid?: (message: string) => void;
  /** Before committing a valid scope (e.g. clear stale pair errors). */
  onApplyValid?: () => void;
};

export function useRankDiningHallScope({
  onApplyInvalid,
  onApplyValid,
}: UseRankDiningHallScopeOptions = {}) {
  const [hallOptions, setHallOptions] = useState<DiningHallOption[]>([]);
  const [hallsStatus, setHallsStatus] = useState<HallsLoadStatus>("loading");
  const [hallsError, setHallsError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<RankScopeMode>("all");
  /** Hall UUIDs checked when filterMode is "subset". */
  const [subsetIds, setSubsetIds] = useState<Set<string>>(() => new Set());
  /** Hall names passed to the API; updating this triggers a new random pair upstream. */
  const [activeFilterNames, setActiveFilterNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setHallsStatus("loading");
      setHallsError(null);
      try {
        const halls = await fetchDiningHalls();
        if (cancelled) return;
        setHallOptions(halls);
        setSubsetIds(new Set(halls.map((h) => h.id)));
        // Default scope: all halls; backend expects explicit names, not “empty = all”.
        setActiveFilterNames(halls.map((h) => h.name));
        setHallsStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setHallsError(errorMessage(e, "Failed to load dining halls."));
        setHallsStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const draftFilterNames = useMemo(() => {
    if (filterMode === "all") return hallOptions.map((h) => h.name);
    return hallOptions.filter((h) => subsetIds.has(h.id)).map((h) => h.name);
  }, [filterMode, hallOptions, subsetIds]);

  /** True when Apply would send the same hall set already in use (button stays off). */
  const scopeSelectionMatchesApplied = sameHallNameSet(
    draftFilterNames,
    activeFilterNames,
  );

  const applyScope = useCallback(() => {
    if (draftFilterNames.length === 0) {
      onApplyInvalid?.("Select at least one dining hall.");
      return;
    }
    onApplyValid?.();
    setActiveFilterNames(draftFilterNames);
  }, [draftFilterNames, onApplyInvalid, onApplyValid]);

  const toggleSubsetHall = useCallback((id: string) => {
    setSubsetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllSubset = useCallback(() => {
    setSubsetIds(new Set(hallOptions.map((h) => h.id)));
  }, [hallOptions]);

  const clearSubset = useCallback(() => {
    setSubsetIds(new Set());
  }, []);

  return {
    hallOptions,
    hallsStatus,
    hallsError,
    activeFilterNames,
    draftFilterNames,
    scopeSelectionMatchesApplied,
    filterMode,
    setFilterMode,
    subsetIds,
    toggleSubsetHall,
    selectAllSubset,
    clearSubset,
    applyScope,
  };
}
