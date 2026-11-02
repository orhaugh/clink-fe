import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TopBar } from './TopBar'
import { setAuthToken } from '@/lib/auth'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

// What a Coordinator started with CLINK_AUTH_TOKEN answers a request without
// the token, or with the wrong one. Only the members the client reads.
const unauthorized = async () =>
  ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ error: 'unauthorized' }),
  }) as unknown as Response

// Answers every request the bar makes (the health and the cluster) through
// `respond`, with no retries, so the first answer is the one shown.
function renderBar(respond: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(respond))
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <TopBar />
    </QueryClientProvider>,
  )
}

describe('TopBar', () => {
  it('says a token is required when the Coordinator answers 401, not that it is unreachable', async () => {
    renderBar(unauthorized)
    expect(await screen.findByText('token required')).toBeInTheDocument()
    expect(screen.queryByText('coordinator unreachable')).not.toBeInTheDocument()
  })

  it('says the token was refused when one is set and the answer is still 401', async () => {
    setAuthToken('not-the-token')
    renderBar(unauthorized)
    expect(await screen.findByText('token refused')).toBeInTheDocument()
  })

  it('calls the Coordinator unreachable when the request itself fails', async () => {
    renderBar(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await screen.findByText('coordinator unreachable')).toBeInTheDocument()
  })
})
