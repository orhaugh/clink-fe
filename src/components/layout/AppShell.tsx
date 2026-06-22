import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { EventsProvider } from '@/components/EventsProvider'

export function AppShell() {
  return (
    <EventsProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1600px] space-y-6 p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </EventsProvider>
  )
}
