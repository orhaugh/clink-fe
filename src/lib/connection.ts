// What the top bar says about the Coordinator, from its health check.
//
// A Coordinator started with CLINK_AUTH_TOKEN answers 401 until the console
// sends the token, so a 401 means it was reached: the bar says a token is
// wanted, or that the one set was refused, while the page asks for it. Any
// other failure means the Coordinator could not be reached.
import { ApiError } from './api'
import type { Health } from './types'

export type CoordinatorTone = 'ok' | 'warn' | 'danger' | 'idle'

export interface CoordinatorStatus {
  tone: CoordinatorTone
  label: string
}

export function coordinatorStatus(
  health: { data: Health | undefined; error: unknown },
  hasToken: boolean,
): CoordinatorStatus {
  if (health.error instanceof ApiError && health.error.status === 401) {
    return { tone: 'warn', label: hasToken ? 'token refused' : 'token required' }
  }
  if (health.error) return { tone: 'danger', label: 'coordinator unreachable' }
  if (!health.data) return { tone: 'idle', label: 'checking coordinator' }
  return health.data.ok
    ? { tone: 'ok', label: 'coordinator healthy' }
    : { tone: 'danger', label: 'coordinator unhealthy' }
}
