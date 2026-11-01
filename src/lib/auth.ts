// The token a cluster started with CLINK_AUTH_TOKEN asks for. It is kept for
// this browser tab's session only (sessionStorage) and never put in a URL, and
// every API request and the live event stream carry it once it is set.
//
// Storage can be unavailable (a private window, blocked site data), so every
// access tolerates a throw: the console then simply asks again.

const KEY = 'clink.authToken'

// Fired on window whenever the token changes, so the live event stream can
// reconnect with it.
export const AUTH_TOKEN_EVENT = 'clink:auth-token'

export function getAuthToken(): string {
  try {
    return sessionStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

// An empty token forgets the stored one.
export function setAuthToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(KEY, token)
    else sessionStorage.removeItem(KEY)
  } catch {
    /* storage unavailable: the console asks again on the next 401 */
  }
  window.dispatchEvent(new Event(AUTH_TOKEN_EVENT))
}

// The request init to send: unchanged without a token, so a cluster that asks
// for none sees exactly the requests it always did.
export function withAuth(init: RequestInit = {}): RequestInit {
  const token = getAuthToken()
  if (!token) return init
  return {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      authorization: `Bearer ${token}`,
    },
  }
}
