import { afterEach, describe, expect, it, vi } from 'vitest'
import { AUTH_TOKEN_EVENT, getAuthToken, setAuthToken, withAuth } from './auth'

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('auth token', () => {
  it('is empty until set, and forgotten when set to empty', () => {
    expect(getAuthToken()).toBe('')
    setAuthToken('s3cret')
    expect(getAuthToken()).toBe('s3cret')
    setAuthToken('')
    expect(getAuthToken()).toBe('')
  })

  it('announces every change on window', () => {
    const seen = vi.fn()
    window.addEventListener(AUTH_TOKEN_EVENT, seen)
    setAuthToken('a')
    setAuthToken('')
    window.removeEventListener(AUTH_TOKEN_EVENT, seen)
    expect(seen).toHaveBeenCalledTimes(2)
  })

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => setAuthToken('x')).not.toThrow()
    expect(getAuthToken()).toBe('')
  })
})

describe('withAuth', () => {
  it('leaves a request untouched when no token is set', () => {
    const init = { method: 'POST' }
    expect(withAuth(init)).toBe(init)
    expect(withAuth()).toEqual({})
  })

  it('adds the bearer header beside the headers a request already has', () => {
    setAuthToken('s3cret')
    expect(withAuth({ method: 'POST', headers: { 'content-type': 'text/plain' } })).toEqual({
      method: 'POST',
      headers: { 'content-type': 'text/plain', authorization: 'Bearer s3cret' },
    })
    expect(withAuth()).toEqual({ headers: { authorization: 'Bearer s3cret' } })
  })
})
