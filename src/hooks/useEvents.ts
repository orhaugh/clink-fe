import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EVENTS_PATH } from '@/lib/api'
import { AUTH_TOKEN_EVENT, getAuthToken } from '@/lib/auth'
import { readEventStream } from '@/lib/sse'
import { qk } from './useApi'
import type { ClinkEvent } from '@/lib/types'

// Named SSE events the coordinator publishes (events::publish in
// src/cluster/coordinator.cpp): a worker registering, a worker declared lost
// (payload: worker_id and the cause, from the watchdog's loss handler), a job
// submitted, its lineage extracted (shortly after the submit), and a job
// completing. clink sets the SSE `event:` field to the type, so we attach a
// listener per type (EventSource has no wildcard) plus the default `message`
// channel as a fallback.
export const EVENT_TYPES = [
  'coordinator.worker_registered',
  'coordinator.worker_lost',
  'coordinator.job_submitted',
  'coordinator.job_lineage',
  'coordinator.job_completed',
] as const

export type ConnState = 'connecting' | 'open' | 'closed'

const MAX_EVENTS = 200

let eventSeq = 0

// Back-off between reconnects of the stream read through fetch, which has no
// EventSource to reconnect it: from one second, doubling to ten.
const RETRY_MIN_MS = 1000
const RETRY_MAX_MS = 10000

export function useEvents() {
  const qc = useQueryClient()
  const [events, setEvents] = useState<ClinkEvent[]>([])
  const [state, setState] = useState<ConnState>('connecting')
  // Bumped whenever the token changes, so the stream reconnects carrying it.
  const [tokenEpoch, setTokenEpoch] = useState(0)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const bump = () => setTokenEpoch((n) => n + 1)
    window.addEventListener(AUTH_TOKEN_EVENT, bump)
    return () => window.removeEventListener(AUTH_TOKEN_EVENT, bump)
  }, [])

  useEffect(() => {
    const push = (type: string, data: string) => {
      const ev: ClinkEvent = { id: `${Date.now()}-${eventSeq++}`, type, data, ts: Date.now() }
      setEvents((prev) => [ev, ...prev].slice(0, MAX_EVENTS))
      // Refresh the topology views the event affects.
      if (type.startsWith('coordinator.worker')) {
        void qc.invalidateQueries({ queryKey: qk.workers })
        void qc.invalidateQueries({ queryKey: qk.cluster })
      }
      if (type.startsWith('coordinator.job')) {
        void qc.invalidateQueries({ queryKey: qk.jobs })
        void qc.invalidateQueries({ queryKey: qk.cluster })
      }
      // Lineage queries never go stale on their own (useJobLineage), so the
      // event that announces a job's lineage is what refreshes an open page.
      if (type === 'coordinator.job_lineage') {
        void qc.invalidateQueries({ queryKey: ['jobLineage'] })
      }
    }

    const token = getAuthToken()
    if (token) {
      // A cluster with a token wants it on this request too, and EventSource
      // cannot send headers, so the stream is read through fetch and
      // reconnected here.
      const ctrl = new AbortController()
      const run = async () => {
        let delay = RETRY_MIN_MS
        while (!ctrl.signal.aborted) {
          try {
            const res = await fetch(EVENTS_PATH, {
              headers: { accept: 'text/event-stream', authorization: `Bearer ${token}` },
              signal: ctrl.signal,
            })
            if (res.status === 401) {
              // Refused: the pages ask for another token, and a new one
              // reconnects through tokenEpoch.
              setState('closed')
              return
            }
            if (!res.ok || !res.body) throw new Error(`events: HTTP ${res.status}`)
            setState('open')
            delay = RETRY_MIN_MS
            await readEventStream(res.body, (e) => push(e.type, e.data))
          } catch {
            if (ctrl.signal.aborted) return
          }
          setState('connecting')
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay = Math.min(delay * 2, RETRY_MAX_MS)
        }
      }
      void run()
      return () => ctrl.abort()
    }

    const es = new EventSource(EVENTS_PATH)
    esRef.current = es
    // No sync setState here: the initial useState('connecting') covers the
    // fresh stream, and the effect only re-runs if the QueryClient or the
    // token changes.
    const onOpen = () => setState('open')
    const onError = () => setState(es.readyState === EventSource.CLOSED ? 'closed' : 'connecting')

    es.addEventListener('open', onOpen)
    es.addEventListener('error', onError)
    es.addEventListener('message', (e) => push('message', (e as MessageEvent).data))
    for (const t of EVENT_TYPES) {
      es.addEventListener(t, (e) => push(t, (e as MessageEvent).data))
    }

    return () => {
      es.removeEventListener('open', onOpen)
      es.removeEventListener('error', onError)
      es.close()
      esRef.current = null
    }
  }, [qc, tokenEpoch])

  return { events, state }
}
