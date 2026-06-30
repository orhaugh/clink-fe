import { Link } from 'react-router-dom'
import { Activity, Cpu, HardDrive, MemoryStick } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { LoadingState, ErrorState } from '@/components/States'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useMetricsText } from '@/hooks/useApi'
import { fmtBytes, fmtCount, pct } from '@/lib/format'
import {
  toView,
  familyTotal,
  scalar,
  byLabel,
  avgFromSumCount,
  type MetricsView,
} from '@/lib/prometheus'
import { cn } from '@/lib/utils'

// "-" for an absent metric, formatted count otherwise.
function n(v: number | undefined): string {
  return v == null ? '-' : fmtCount(v)
}

function ms(v: number | undefined): string {
  if (v == null) return '-'
  if (v < 1) return `${(v * 1000).toFixed(0)} us`
  if (v < 1000) return `${v.toFixed(1)} ms`
  return `${(v / 1000).toFixed(2)} s`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h2 className="mb-3 text-sm font-semibold tracking-tight">{title}</h2>
      {children}
    </Card>
  )
}

// A compact label/value cell used inside a section grid.
function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-md border border-border/60 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-lg font-semibold tabular-nums', tone)}>{value}</div>
    </div>
  )
}

const grid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'

function Checkpoints({ v }: { v: MetricsView }) {
  return (
    <Section title="Checkpoints">
      <div className={grid}>
        <Stat label="Triggered" value={n(familyTotal(v, 'clink_ckpt_triggered_total'))} />
        <Stat label="Completed" value={n(familyTotal(v, 'clink_ckpt_completed_total'))} tone="text-ok" />
        <Stat label="Failed" value={n(familyTotal(v, 'clink_ckpt_failed_total'))} tone="text-danger" />
        <Stat label="Mean duration" value={ms(avgFromSumCount(v, 'clink_ckpt_duration_ms'))} />
        <Stat
          label="Mean restore"
          value={ms(
            avgFromSumCount(v, 'clink_ckpt_restore_ns') != null
              ? avgFromSumCount(v, 'clink_ckpt_restore_ns')! / 1e6
              : undefined,
          )}
        />
        <Stat label="Subtask acks" value={n(familyTotal(v, 'clink_ckpt_subtask_snapshot_ack_total'))} />
        <Stat
          label="Subtask ack failures"
          value={n(familyTotal(v, 'clink_ckpt_subtask_snapshot_failure_total'))}
        />
      </div>
    </Section>
  )
}

function StateDisagg({ v }: { v: MetricsView }) {
  const hits = familyTotal(v, 'clink_disagg_remote_hot_hits_total')
  const loads = familyTotal(v, 'clink_disagg_remote_loads_total')
  const hitRate =
    hits != null && loads != null && hits + loads > 0 ? `${pct(hits, hits + loads).toFixed(0)}%` : '-'
  return (
    <Section title="State &amp; disaggregation">
      <div className={grid}>
        <Stat label="Snapshots" value={n(familyTotal(v, 'clink_state_snapshot_total'))} />
        <Stat
          label="Snapshot failures"
          value={n(familyTotal(v, 'clink_state_snapshot_failures_total'))}
          tone="text-danger"
        />
        <Stat label="Restores" value={n(familyTotal(v, 'clink_state_restore_total'))} />
        <Stat label="Live keys" value={n(familyTotal(v, 'clink_state_keyed_keys'))} />
        <Stat label="Hot-tier hit rate" value={hitRate} tone="text-info" />
        <Stat label="Remote hot hits" value={n(hits)} />
        <Stat label="Remote loads" value={n(loads)} />
        <Stat
          label="Hot evictions"
          value={n(familyTotal(v, 'clink_disagg_hot_evictions_total'))}
          tone="text-warn"
        />
        <Stat
          label="Hot resident"
          value={fmtBytes(scalar(v, 'clink_disagg_hot_resident_bytes'))}
        />
        <Stat label="Object-cache hits" value={n(familyTotal(v, 'clink_disagg_object_cache_hits_total'))} />
        <Stat
          label="Object-cache misses"
          value={n(familyTotal(v, 'clink_disagg_object_cache_misses_total'))}
        />
        <Stat label="CAS uploaded" value={n(familyTotal(v, 'clink_disagg_cas_objects_uploaded_total'))} />
        <Stat
          label="CAS downloaded"
          value={n(familyTotal(v, 'clink_disagg_cas_objects_downloaded_total'))}
        />
      </div>
    </Section>
  )
}

interface ConnRow {
  connector: string
  direction: string
  records?: number
  bytes?: number
  lag?: number
  dropped?: number
}

function Connectors({ v }: { v: MetricsView }) {
  const rows = new Map<string, ConnRow>()
  const key = (c: string, d: string) => `${c}|${d}`
  const ensure = (c: string, d: string) => {
    const k = key(c, d)
    let r = rows.get(k)
    if (!r) {
      r = { connector: c, direction: d }
      rows.set(k, r)
    }
    return r
  }
  const fam = (name: string) => v.byName.get(name)?.samples ?? []
  for (const s of fam('clink_connector_records_total'))
    ensure(s.labels.connector ?? '?', s.labels.direction ?? '?').records = s.value
  for (const s of fam('clink_connector_bytes_total'))
    ensure(s.labels.connector ?? '?', s.labels.direction ?? '?').bytes = s.value
  for (const s of fam('clink_connector_consumer_lag'))
    ensure(s.labels.connector ?? '?', s.labels.direction ?? '?').lag = s.value
  for (const s of fam('clink_connector_dropped_records_total'))
    ensure(s.labels.connector ?? '?', s.labels.direction ?? '?').dropped = s.value
  const list = [...rows.values()].sort(
    (a, b) => a.connector.localeCompare(b.connector) || a.direction.localeCompare(b.direction),
  )
  return (
    <Section title="Connectors">
      {list.length === 0 ? (
        <div className="py-4 text-sm text-muted-foreground">No connector activity reported.</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Connector</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Records</TableHead>
              <TableHead className="text-right">Bytes</TableHead>
              <TableHead className="text-right">Lag</TableHead>
              <TableHead className="text-right">Dropped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={`${r.connector}|${r.direction}`}>
                <TableCell className="font-mono">{r.connector}</TableCell>
                <TableCell className="text-muted-foreground">{r.direction}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.records)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBytes(r.bytes)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.lag)}</TableCell>
                <TableCell className="text-right tabular-nums">{n(r.dropped)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  )
}

function SqlPipeline({ v }: { v: MetricsView }) {
  const stages: { label: string; total: string; err: string; base: string }[] = [
    { label: 'Parse', total: 'clink_sql_parses_total', err: 'clink_sql_parse_errors_total', base: 'clink_sql_parse_duration_ns' },
    { label: 'Bind', total: 'clink_sql_binds_total', err: 'clink_sql_bind_errors_total', base: 'clink_sql_bind_duration_ns' },
    { label: 'Optimise', total: 'clink_sql_optimizes_total', err: 'clink_sql_optimize_errors_total', base: 'clink_sql_optimize_duration_ns' },
    { label: 'Physical', total: 'clink_sql_physical_plans_total', err: '', base: 'clink_sql_physical_plan_duration_ns' },
  ]
  return (
    <Section title="SQL pipeline">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Errors</TableHead>
            <TableHead className="text-right">Mean latency</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((s) => {
            const avg = avgFromSumCount(v, s.base)
            return (
              <TableRow key={s.label}>
                <TableCell>{s.label}</TableCell>
                <TableCell className="text-right tabular-nums">{n(familyTotal(v, s.total))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.err ? n(familyTotal(v, s.err)) : '-'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {ms(avg != null ? avg / 1e6 : undefined)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Section>
  )
}

function Resilience({ v }: { v: MetricsView }) {
  const ioAvg = avgFromSumCount(v, 'clink_io_uring_completion_latency_ns')
  return (
    <Section title="Resilience">
      <div className={grid}>
        <Stat label="Breaker trips" value={n(familyTotal(v, 'clink_circuit_breaker_trips_total'))} tone="text-warn" />
        <Stat label="Calls allowed" value={n(familyTotal(v, 'clink_circuit_breaker_calls_allowed_total'))} />
        <Stat label="Calls rejected" value={n(familyTotal(v, 'clink_circuit_breaker_calls_rejected_total'))} tone="text-danger" />
        <Stat label="Retry attempts" value={n(familyTotal(v, 'clink_retry_attempts_total'))} />
        <Stat label="Retry give-ups" value={n(familyTotal(v, 'clink_retry_giveup_total'))} tone="text-danger" />
        <Stat label="io_uring completions" value={n(familyTotal(v, 'clink_io_uring_completions_total'))} />
        <Stat label="io_uring mean" value={ms(ioAvg != null ? ioAvg / 1e6 : undefined)} />
        <Stat label="HTTP pool in use" value={n(scalar(v, 'clink_http_pool_connections'))} />
        <Stat label="HTTP pool idle" value={n(scalar(v, 'clink_http_pool_idle_connections'))} />
        <Stat label="Pool acquire blocks" value={n(familyTotal(v, 'clink_http_pool_acquire_blocks_total'))} />
      </div>
    </Section>
  )
}

function Orchestration({ v }: { v: MetricsView }) {
  const decisions = byLabel(v, 'clink_autoscaler_decisions_total', 'outcome')
    .filter((d) => d.key)
    .sort((a, b) => b.value - a.value)
  return (
    <Section title="Cluster orchestration">
      <div className={grid}>
        <Stat label="Jobs running" value={n(scalar(v, 'clink_jm_jobs_running'))} />
        <Stat label="Jobs completed" value={n(familyTotal(v, 'clink_jm_jobs_completed_total'))} tone="text-ok" />
        <Stat label="Jobs failed" value={n(familyTotal(v, 'clink_jm_jobs_failed_total'))} tone="text-danger" />
        <Stat label="TMs registered" value={n(scalar(v, 'clink_jm_tms_registered'))} />
        <Stat label="TMs lost" value={n(familyTotal(v, 'clink_jm_tms_lost_total'))} tone="text-warn" />
        <Stat label="Rescale cutovers" value={n(familyTotal(v, 'clink_rescale_cutover_deploys_total'))} />
        <Stat label="Rescale aborts" value={n(familyTotal(v, 'clink_rescale_aborts_total'))} tone="text-warn" />
        <Stat label="Autoscaler ticks" value={n(familyTotal(v, 'clink_autoscaler_ticks_total'))} />
        <Stat label="HA takeovers" value={n(familyTotal(v, 'clink_ha_leader_takeovers_total'))} />
        <Stat label="HA recovered jobs" value={n(familyTotal(v, 'clink_ha_recovered_jobs_total'))} />
      </div>
      {decisions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Autoscaler decisions
          </div>
          <div className="flex flex-wrap gap-2">
            {decisions.map((d) => (
              <span key={d.key} className="rounded-md border border-border/60 px-2 py-1 text-xs">
                <span className="text-muted-foreground">{d.key}</span>{' '}
                <span className="font-semibold tabular-nums">{fmtCount(d.value)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function ProcessSystem({ v }: { v: MetricsView }) {
  // Disk volumes: total/free/used by {volume=}.
  const total = byLabel(v, 'clink_disk_total_bytes', 'volume')
  const used = new Map(byLabel(v, 'clink_disk_used_bytes', 'volume').map((x) => [x.key, x.value]))
  return (
    <Section title="Process &amp; system">
      <div className={grid}>
        <Stat label="Resident memory" value={fmtBytes(scalar(v, 'clink_process_resident_memory_bytes'))} />
        <Stat label="Virtual memory" value={fmtBytes(scalar(v, 'clink_process_virtual_memory_bytes'))} />
        <Stat label="CPU" value={`${(scalar(v, 'clink_process_cpu_percent') ?? 0).toFixed(0)}%`} />
        <Stat label="Open FDs" value={n(scalar(v, 'clink_process_open_fds'))} />
        <Stat label="Threads" value={n(scalar(v, 'clink_process_threads'))} />
      </div>
      {total.length > 0 && (
        <div className="mt-3 space-y-2">
          {total.map((t) => {
            const u = used.get(t.key) ?? 0
            const usedPct = t.value > 0 ? pct(u, t.value) : 0
            return (
              <div key={t.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">{t.key || 'volume'}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmtBytes(u)} / {fmtBytes(t.value)} ({usedPct.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-muted">
                  <div
                    className={cn('h-full', usedPct > 90 ? 'bg-danger' : usedPct > 75 ? 'bg-warn' : 'bg-primary')}
                    style={{ width: `${Math.min(100, usedPct)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

export function MetricsDashboards() {
  const { data: text, isLoading, isError, error } = useMetricsText()

  if (isLoading && !text) return <LoadingState label="Loading metrics" />
  if (isError) return <ErrorState error={error} />

  const v = toView(text ?? '')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metrics dashboards"
        description="Engine telemetry grouped by domain, from the JobManager's Prometheus feed."
        actions={
          <Link to="/metrics" className="text-sm text-primary hover:underline">
            Raw explorer &rarr;
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs running" value={n(scalar(v, 'clink_jm_jobs_running'))} icon={Activity} tone="info" />
        <StatCard
          label="Slots in use"
          value={`${n(scalar(v, 'clink_jm_slots_in_use'))} / ${n(scalar(v, 'clink_jm_slots_capacity'))}`}
          icon={Activity}
        />
        <StatCard
          label="Resident memory"
          value={fmtBytes(scalar(v, 'clink_process_resident_memory_bytes'))}
          icon={MemoryStick}
        />
        <StatCard
          label="CPU"
          value={`${(scalar(v, 'clink_process_cpu_percent') ?? 0).toFixed(0)}%`}
          icon={Cpu}
        />
      </div>

      <Checkpoints v={v} />
      <StateDisagg v={v} />
      <Connectors v={v} />
      <SqlPipeline v={v} />
      <Resilience v={v} />
      <Orchestration v={v} />
      <ProcessSystem v={v} />

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <HardDrive className="h-3.5 w-3.5" />
        Counters are process totals since start. Every metric family is also searchable on the{' '}
        <Link to="/metrics" className="text-primary hover:underline">
          raw explorer
        </Link>
        .
      </div>
    </div>
  )
}
