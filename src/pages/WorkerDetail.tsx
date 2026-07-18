import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  useWorker,
  useWorkerConfig,
  useWorkerLogs,
  useWorkerMetricsText,
  useWorkerSubtasks,
} from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { SubtaskStatusBadge } from '@/components/StatusBadge'
import { LogViewer } from '@/components/LogViewer'
import { MetricsPanel } from '@/components/MetricsPanel'
import { fmtMs } from '@/lib/format'

export function WorkerDetail() {
  const { id = '' } = useParams()
  const worker = useWorker(id)
  const subtasks = useWorkerSubtasks(id)
  const config = useWorkerConfig(id)
  const metrics = useWorkerMetricsText(id)
  const logs = useWorkerLogs(id, { level: 'debug', limit: 400 })

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link to="/workers" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="font-mono">{id}</span>
          </span>
        }
        description="Worker detail, proxied from the Coordinator."
      />

      {worker.isError ? (
        <ErrorState error={worker.error} />
      ) : worker.isLoading || !worker.data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Slots"
              value={`${worker.data.slots_in_use}/${worker.data.slot_capacity}`}
            />
            <StatCard label="Active subtasks" value={worker.data.active_subtasks} tone="info" />
            <StatCard
              label="Data host"
              value={<span className="font-mono text-base">{worker.data.data_host}</span>}
            />
            <StatCard
              label="Coordinator"
              value={
                <span className="font-mono text-base">
                  {worker.data.coordinator_host}:{worker.data.coordinator_port}
                </span>
              }
            />
          </div>

          <Tabs defaultValue="subtasks">
            <TabsList>
              <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
              <TabsTrigger value="config">Config</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="subtasks">
              <Card>
                <CardContent className="px-0 py-0">
                  {subtasks.isError ? (
                    <ErrorState error={subtasks.error} />
                  ) : subtasks.isLoading || !subtasks.data ? (
                    <LoadingState />
                  ) : subtasks.data.length === 0 ? (
                    <EmptyState label="No subtasks running on this Worker" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Subtask</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subtasks.data.map((s, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Link
                                to={`/jobs/${s.job_id}`}
                                className="font-mono text-primary hover:underline"
                              >
                                #{s.job_id}
                              </Link>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{s.role}</TableCell>
                            <TableCell className="tabular-nums">{s.subtask_idx}</TableCell>
                            <TableCell>
                              <SubtaskStatusBadge status={s.status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config">
              <Card>
                <CardContent className="py-5">
                  {config.isError ? (
                    <ErrorState error={config.error} />
                  ) : config.data ? (
                    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      <Field label="Slot count" value={config.data.slot_count} />
                      <Field
                        label="Heartbeat interval"
                        value={fmtMs(config.data.heartbeat_interval_ms)}
                      />
                    </dl>
                  ) : (
                    <LoadingState />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="metrics">
              <MetricsPanel
                text={metrics.data}
                isLoading={metrics.isLoading}
                isError={metrics.isError}
                error={metrics.error}
              />
            </TabsContent>

            <TabsContent value="logs">
              {logs.isError ? (
                <ErrorState error={logs.error} />
              ) : (
                <LogViewer
                  records={logs.data ?? []}
                  heightClass="h-[60vh]"
                  emptyLabel="No logs from this Worker"
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  )
}
