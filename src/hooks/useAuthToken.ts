import { useSyncExternalStore } from 'react'
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth'

const subscribe = (onChange: () => void) => {
  window.addEventListener(AUTH_TOKEN_EVENT, onChange)
  return () => window.removeEventListener(AUTH_TOKEN_EVENT, onChange)
}

// The token currently set for this tab ('' for none), re-rendering on change.
export const useAuthToken = () => useSyncExternalStore(subscribe, getAuthToken, () => '')
