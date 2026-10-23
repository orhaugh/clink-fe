import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EVENTS_PATH } from '@/lib/api'
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

export function useEvents() {
  const qc = useQueryClient()
  const [events, setEvents] = useState<ClinkEvent[]>([])
  const [state, setState] = useState<ConnState>('connecting')
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const es = new EventSource(EVENTS_PATH)
    esRef.current = es
    // No sync setState here: the initial useState('connecting') covers the
    // fresh stream, and the effect only re-runs if the QueryClient changes.

    const onOpen = () => setState('open')
    const onError = () => setState(es.readyState === EventSource.CLOSED ? 'closed' : 'connecting')

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
  }, [qc])

  return { events, state }
}
