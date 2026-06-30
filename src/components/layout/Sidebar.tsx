import { NavLink } from 'react-router-dom'
import {
  Activity,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  Plug,
  ScrollText,
  Server,
  Terminal,
  UploadCloud,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/jobs', label: 'Jobs', icon: Workflow, end: false },
  { to: '/sql', label: 'SQL workbench', icon: Terminal, end: false },
  { to: '/task-managers', label: 'TaskManagers', icon: Server, end: false },
  { to: '/connectors', label: 'Connectors', icon: Plug, end: false },
  { to: '/submit', label: 'Submit job', icon: UploadCloud, end: false },
  { to: '/dashboards', label: 'Metrics', icon: Gauge, end: false },
  { to: '/metrics', label: 'Metrics (raw)', icon: FileBarChart, end: false },
  { to: '/logs', label: 'Logs', icon: ScrollText, end: false },
]

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex h-14 items-center gap-2 border-b border-border px-5">
        <Activity className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">
          clink<span className="text-primary"> console</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-4 text-xs text-muted-foreground">
        Arrow-native stream engine
      </div>
    </aside>
  )
}
