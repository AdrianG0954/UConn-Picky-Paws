/** All halls vs user-picked subset (draft until Apply on the rank page). */
export type RankScopeMode = "all" | "subset";

/** GET /dining-halls fetch lifecycle for the scope hook. */
export type HallsLoadStatus = "loading" | "ready" | "error";
