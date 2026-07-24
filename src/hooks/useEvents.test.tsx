import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEvents } from './useEvents'
import { qk } from './useApi'

// jsdom has no EventSource; a controllable mock lets tests drive open/error and
// dispatch named SSE events at the hook.
class MockEventSource {
  static instances: MockEventSource[] = []
  static readonly CLOSED = 2
  url: string
  readyState = 0
  closed = false
  private listeners: Record<string, Array<(e: unknown) => void>> = {}
  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }
  addEventListener(type: string, cb: (e: unknown) => void) {
    ;(this.listeners[type] ??= []).push(cb)
  }
  removeEventListener(type: string, cb: (e: unknown) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb)
  }
  close() {
    this.closed = true
    this.readyState = MockEventSource.CLOSED
  }
  emit(type: string, data?: string) {
    for (const cb of this.listeners[type] ?? []) cb({ data } as MessageEvent)
  }
}

let qc: QueryClient

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
  qc = new QueryClient()
  vi.spyOn(qc, 'invalidateQueries').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

const es = () => MockEventSource.instances[0]

describe('useEvents', () => {
  it('opens one EventSource on the events path and starts connecting', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    expect(MockEventSource.instances).toHaveLength(1)
    expect(es().url).toBe('/api/v1/events')
    expect(result.current.state).toBe('connecting')
    expect(result.current.events).toEqual([])
  })

  it('transitions to open on the open event', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    act(() => es().emit('open'))
    expect(result.current.state).toBe('open')
  })

  it('reports closed when an error fires with readyState CLOSED', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    act(() => {
      es().readyState = MockEventSource.CLOSED
      es().emit('error')
    })
    expect(result.current.state).toBe('closed')
  })

  it('stays connecting when an error fires while the stream is still retrying', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    act(() => es().emit('open'))
    expect(result.current.state).toBe('open')
    act(() => es().emit('error')) // readyState still CONNECTING: browser is retrying
    expect(result.current.state).toBe('connecting')
  })

  it('accumulates events newest-first', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    act(() => es().emit('coordinator.job_submitted', 'job 1'))
    act(() => es().emit('coordinator.job_completed', 'job 1 done'))
    expect(result.current.events).toHaveLength(2)
    expect(result.current.events[0]).toMatchObject({
      type: 'coordinator.job_completed',
      data: 'job 1 done',
    })
    expect(result.current.events[1]).toMatchObject({ type: 'coordinator.job_submitted' })
  })

  it('invalidates worker + cluster queries on a worker event', () => {
    renderHook(() => useEvents(), { wrapper })
    act(() => es().emit('coordinator.worker_registered', 'w-1'))
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.workers })
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.cluster })
  })

  it('invalidates jobs + cluster queries on a job event', () => {
    renderHook(() => useEvents(), { wrapper })
    act(() => es().emit('coordinator.job_completed', 'x'))
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.jobs })
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.cluster })
  })

  it('caps retained events at 200', () => {
    const { result } = renderHook(() => useEvents(), { wrapper })
    act(() => {
      for (let i = 0; i < 205; i++) es().emit('message', `m${i}`)
    })
    expect(result.current.events).toHaveLength(200)
    // Newest-first: the most recent message is at the head.
    expect(result.current.events[0].data).toBe('m204')
  })

  it('closes the EventSource on unmount', () => {
    const { unmount } = renderHook(() => useEvents(), { wrapper })
    const source = es()
    expect(source.closed).toBe(false)
    unmount()
    expect(source.closed).toBe(true)
  })
})
