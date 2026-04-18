const ACCESS_TOKEN_KEY = "dining_hall_ranker_access_token";
const EXPIRY_LEEWAY_MS = 15_000;

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  const [, payload] = accessToken.split(".");
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getJwtExpiryMs(accessToken: string): number | null {
  const payload = decodeJwtPayload(accessToken);
  const exp = payload?.exp;

  if (typeof exp !== "number") {
    return null;
  }

  return exp * 1000;
}

function readStoredAccessToken(): string | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)?.trim();
  if (!accessToken) {
    return null;
  }

  const expiryMs = getJwtExpiryMs(accessToken);
  if (!expiryMs || Date.now() + EXPIRY_LEEWAY_MS >= expiryMs) {
    clearAccessToken();
    return null;
  }

  return accessToken;
}

export function getAccessToken(): string | null {
  return readStoredAccessToken();
}

export function setAccessToken(accessToken: string): void {
  const trimmedToken = accessToken.trim();
  const expiryMs = getJwtExpiryMs(trimmedToken);

  if (!trimmedToken || !expiryMs) {
    throw new Error("CAS callback did not return a valid session.");
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, trimmedToken);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function isSessionAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
