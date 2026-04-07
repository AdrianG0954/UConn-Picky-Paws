/**
 * Same multiset of hall names (order ignored). Used to disable Apply when nothing changed.
 */
export function sameHallNameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (xs: string[]) => [...xs].sort();
  const sa = sorted(a);
  const sb = sorted(b);
  return sa.every((v, i) => v === sb[i]);
}
