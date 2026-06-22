import { Link } from 'react-router-dom'
import { Cpu, Server, Workflow, CheckCircle2, Radio } from 'lucide-react'
import { useCluster, useJobs } from '@/hooks/useApi'
import { useEventsContext } from '@/components/EventsProvider'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { JobStateBadge, TmStateBadge } from '@/components/StatusBadge'
import { deriveJobState } from '@/lib/types'
import { fmtRelative, pct } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Overview() {
  const cluster = useCluster()
  const jobs = useJobs()
  const { events, state } = useEventsContext()

  if (cluster.isError) return <ErrorState error={cluster.error} />
  if (cluster.isLoading || !cluster.data) return <LoadingState />

  const c = cluster.data
  const liveTms = c.task_managers.filter((t) => !t.lost).length
  const lostTms = c.task_managers.length - liveTms
  const recentJobs = (jobs.data ?? []).slice().sort((a, b) => b.id - a.id).slice(0, 6)

  return (
    <div className="space-y-6">
      <PageHeader title="Cluster overview" description={`${c.advertise_host}:${c.control_port}`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Slots in use"
          value={`${c.slots_in_use}/${c.total_slot_capacity}`}
          sub={`${pct(c.slots_in_use, c.total_slot_capacity)}% utilised`}
          icon={Cpu}
          tone={c.total_slot_capacity > 0 && c.slots_in_use >= c.total_slot_capacity ? 'warn' : 'default'}
        />
        <StatCard
          label="TaskManagers"
          value={liveTms}
          sub={lostTms > 0 ? `${lostTms} lost` : 'all live'}
          icon={Server}
          tone={lostTms > 0 ? 'danger' : 'ok'}
        />
        <StatCard label="Jobs running" value={c.jobs_running} sub={`${c.jobs_total} total`} icon={Workflow} tone="info" />
        <StatCard label="Jobs completed" value={c.jobs_completed} icon={CheckCircle2} tone="ok" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>TaskManager fleet</CardTitle>
            <Link to="/task-managers" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            {c.task_managers.length === 0 ? (
              <EmptyState label="No TaskManagers registered" hint="Start a TM pointing at this JobManager." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TaskManager</TableHead>
                    <TableHead>Host</TableHead>
                    <TableHead>Slots</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.task_managers.map((t) => (
                    <TableRow key={t.tm_id}>
                      <TableCell>
                        <Link to={`/task-managers/${t.tm_id}`} className="font-mono text-primary hover:underline">
                          {t.tm_id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.data_host}</TableCell>
                      <TableCell className="tabular-nums">
                        {t.slots_in_use}/{t.slot_capacity}
                      </TableCell>
                      <TableCell>
                        <TmStateBadge lost={t.lost} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Radio className={cn('h-4 w-4', state === 'open' ? 'text-ok' : 'text-muted-foreground')} />
              Live events
            </CardTitle>
            <span className="text-xs text-muted-foreground">{state}</span>
          </CardHeader>
          <CardContent className="px-0">
            {events.length === 0 ? (
              <EmptyState label="No events yet" hint="TM registrations, job submissions and completions stream here." />
            ) : (
              <ul className="max-h-80 divide-y divide-border overflow-auto">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs text-primary">{e.type}</div>
                      {e.data && e.data !== 'undefined' && (
                        <div className="truncate font-mono text-xs text-muted-foreground" title={e.data}>
                          {e.data}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtRelative(e.ts)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent jobs</CardTitle>
          <Link to="/jobs" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="px-0">
          {recentJobs.length === 0 ? (
            <EmptyState label="No jobs submitted" hint="Submit a compiled job .so or a JSON spec." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link to={`/jobs/${j.id}`} className="font-mono text-primary hover:underline">
                        #{j.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <JobStateBadge state={deriveJobState(j)} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {j.completed_count}/{j.expected_completion}
                    </TableCell>
                    <TableCell className={j.error_count > 0 ? 'text-danger' : 'text-muted-foreground'}>
                      {j.error_count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
