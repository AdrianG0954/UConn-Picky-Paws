/**
 * JWT from CAS callback; sent as Bearer on protected API calls.
 * Not httpOnly — XSS could steal it; acceptable for many student apps; tighten if needed.
 */
const ACCESS_TOKEN_KEY = 'dining_hall_ranker_access_token'

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function isSessionAuthenticated(): boolean {
  return Boolean(getAccessToken()?.trim())
}
