import { describe, expect, it } from 'vitest'
import { ApiError } from './api'
import { coordinatorStatus } from './connection'
import type { Health } from './types'

const healthy: Health = { role: 'coordinator', ok: true, uptime_s: 5, bound_port: 7070 }

describe('coordinatorStatus', () => {
  it('reads a 401 as a token wanted, not as an unreachable Coordinator', () => {
    const error = new ApiError(401, 'unauthorized')
    expect(coordinatorStatus({ data: undefined, error }, false)).toEqual({
      tone: 'warn',
      label: 'token required',
    })
    expect(coordinatorStatus({ data: undefined, error }, true)).toEqual({
      tone: 'warn',
      label: 'token refused',
    })
  })

  it('lets a 401 win over the health read before it, as when a token is forgotten', () => {
    const error = new ApiError(401, 'unauthorized')
    expect(coordinatorStatus({ data: healthy, error }, false).label).toBe('token required')
  })

  it('reads any other failure as unreachable', () => {
    for (const error of [new ApiError(502, '502 Bad Gateway'), new TypeError('Failed to fetch')]) {
      expect(coordinatorStatus({ data: undefined, error }, false)).toEqual({
        tone: 'danger',
        label: 'coordinator unreachable',
      })
    }
  })

  it('says it is checking until the first answer, and what the answer said after', () => {
    expect(coordinatorStatus({ data: undefined, error: null }, false)).toEqual({
      tone: 'idle',
      label: 'checking coordinator',
    })
    expect(coordinatorStatus({ data: healthy, error: null }, true)).toEqual({
      tone: 'ok',
      label: 'coordinator healthy',
    })
    expect(coordinatorStatus({ data: { ...healthy, ok: false }, error: null }, false)).toEqual({
      tone: 'danger',
      label: 'coordinator unhealthy',
    })
  })
})
