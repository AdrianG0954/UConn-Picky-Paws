/** Normalizes unknown thrown values for user-visible error strings. */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
