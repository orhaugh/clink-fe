import { createContext, useContext } from 'react'
import { useEvents, type ConnState } from '@/hooks/useEvents'
import type { ClinkEvent } from '@/lib/types'

interface EventsContextValue {
  events: ClinkEvent[]
  state: ConnState
}

const EventsContext = createContext<EventsContextValue>({ events: [], state: 'connecting' })

// One EventSource for the whole app (mounted at the shell), shared by the
// topbar connection indicator and the overview live feed.
export function EventsProvider({ children }: { children: React.ReactNode }) {
  const value = useEvents()
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}

export function useEventsContext() {
  return useContext(EventsContext)
}
