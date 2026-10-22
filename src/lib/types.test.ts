import { describe, it, expect } from 'vitest'
import { deriveJobState } from './types'

describe('deriveJobState', () => {
  const base = { cancel_requested: false, completion_signalled: false }

  it('is running by default', () => {
    expect(deriveJobState(base)).toBe('running')
  })

  it('failed wins over everything when error_count > 0', () => {
    expect(deriveJobState({ ...base, error_count: 1 })).toBe('failed')
    expect(
      deriveJobState({
        ...base,
        cancel_requested: true,
        completion_signalled: true,
        error_count: 2,
      }),
    ).toBe('failed')
  })

  it('falls back to errors[] length when error_count is absent', () => {
    expect(deriveJobState({ ...base, errors: ['boom'] })).toBe('failed')
    expect(deriveJobState({ ...base, errors: [] })).toBe('running')
  })

  it('prefers explicit error_count over errors[] length', () => {
    expect(deriveJobState({ ...base, error_count: 0, errors: ['ignored'] })).toBe('running')
  })

  it('cancelled outranks completed', () => {
    expect(deriveJobState({ ...base, cancel_requested: true, completion_signalled: true })).toBe(
      'cancelled',
    )
  })

  it('completed when signalled and not cancelled/failed', () => {
    expect(deriveJobState({ ...base, completion_signalled: true })).toBe('completed')
  })

  it("takes the coordinator's own status over the flags when it reports one", () => {
    expect(deriveJobState({ ...base, status: 'RUNNING', error_count: 1 })).toBe('running')
    expect(deriveJobState({ ...base, status: 'COMPLETED_OK' })).toBe('completed')
    expect(deriveJobState({ ...base, status: 'FAILED' })).toBe('failed')
    expect(deriveJobState({ ...base, status: 'CANCELLED', completion_signalled: true })).toBe(
      'cancelled',
    )
  })

  it('falls back to the flags on an empty or unknown status', () => {
    expect(deriveJobState({ ...base, status: '', completion_signalled: true })).toBe('completed')
    expect(deriveJobState({ ...base, status: 'SOMETHING_NEW', error_count: 2 })).toBe('failed')
  })
})
