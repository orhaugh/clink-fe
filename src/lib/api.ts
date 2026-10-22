// Typed client for the clink HTTP API. All paths are relative so the Vite dev
// proxy (and a same-origin production deployment served by the coordinator) route them
// to the Coordinator. The coordinator proxies per-Worker routes under
// /api/v1/workers/:id/*, so the console only ever talks to one origin.

import type {
  CancelAck,
  CatalogTable,
  ClusterSnapshot,
  Health,
  CoordinatorConfig,
  JobDetail,
  JobGraphDetail,
  JobLineage,
  JobOperators,
  JobSummary,
  LogRecord,
  RescaleAck,
  SavepointAck,
  SqlConnector,
  SqlMode,
  SqlResult,
  SubmitAck,
  SubtaskRecord,
  WorkerConfig,
  WorkerSnapshot,
  WorkerSummary,
} from './types'
import { appendRecoveryParams, type RecoveryOptions } from './recovery'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal, headers: { accept: 'application/json' } })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string }
      if (body?.error) msg = body.error
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg)
  }
  return (await res.json()) as T
}

async function getText(path: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(path, { signal })
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`)
  return res.text()
}

export interface LogQuery {
  level?: string
  limit?: number
  since_ms?: number
  source?: string
}

// Serialises with encodeURIComponent rather than URLSearchParams.toString(),
// which writes a space as '+': the coordinator percent-decodes query values
// and a '+' inside a state-backend URI (s3sst+forst://...) must survive.
function encodeQuery(p: URLSearchParams): string {
  const parts: string[] = []
  p.forEach((v, k) => parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`))
  return parts.join('&')
}

function logPath(base: string, q: LogQuery = {}): string {
  const p = new URLSearchParams()
  if (q.level) p.set('level', q.level)
  if (q.limit != null) p.set('limit', String(q.limit))
  if (q.since_ms != null) p.set('since_ms', String(q.since_ms))
  if (q.source) p.set('source', q.source)
  const qs = p.toString()
  return qs ? `${base}?${qs}` : base
}

export const api = {
  // --- Coordinator (cluster) ---
  health: (s?: AbortSignal) => getJson<Health>('/api/v1/health', s),
  cluster: (s?: AbortSignal) => getJson<ClusterSnapshot>('/api/v1/cluster', s),
  coordinatorConfig: (s?: AbortSignal) => getJson<CoordinatorConfig>('/api/v1/config', s),

  jobs: (s?: AbortSignal) => getJson<{ jobs: JobSummary[] }>('/api/v1/jobs', s).then((r) => r.jobs),
  job: (id: number, s?: AbortSignal) => getJson<JobDetail>(`/api/v1/jobs/${id}`, s),
  jobGraph: (id: number, s?: AbortSignal) => getJson<JobGraphDetail>(`/api/v1/jobs/${id}/graph`, s),
  jobOperators: (id: number, s?: AbortSignal) =>
    getJson<JobOperators>(`/api/v1/jobs/${id}/operators`, s),
  jobLineage: (id: number, s?: AbortSignal) => getJson<JobLineage>(`/api/v1/jobs/${id}/lineage`, s),
  cancelJob: async (id: number): Promise<CancelAck> => {
    const res = await fetch(`/api/v1/jobs/${id}/cancel`, { method: 'POST' })
    return (await res.json()) as CancelAck
  },
  savepointJob: async (id: number, timeoutMs?: number): Promise<SavepointAck> => {
    const qs = timeoutMs != null ? `?timeout_ms=${timeoutMs}` : ''
    const res = await fetch(`/api/v1/jobs/${id}/savepoint${qs}`, { method: 'POST' })
    return (await res.json()) as SavepointAck
  },
  rescaleJob: async (id: number, roleParallelism: Record<string, number>): Promise<RescaleAck> => {
    const res = await fetch(`/api/v1/jobs/${id}/rescale`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(roleParallelism),
    })
    return (await res.json()) as RescaleAck
  },
  submitJobSo: async (file: File, jobName?: string): Promise<SubmitAck> => {
    const fd = new FormData()
    fd.append('job_so', file)
    if (jobName) fd.append('job_name', jobName)
    const res = await fetch('/api/v1/jobs', { method: 'POST', body: fd })
    return (await res.json()) as SubmitAck
  },
  // Recovery options ride the query string (checkpoint_dir, checkpoint_interval_ms,
  // state_backend, max_restarts_on_worker_loss, alignment, restore_from_*); an
  // unset one keeps the coordinator's default.
  submitSpec: async (
    specJson: string,
    name?: string,
    recovery?: RecoveryOptions,
  ): Promise<SubmitAck> => {
    const p = new URLSearchParams()
    if (name) p.set('name', name)
    appendRecoveryParams(p, recovery)
    const qs = encodeQuery(p)
    const res = await fetch(`/api/v1/jobs/spec${qs ? `?${qs}` : ''}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: specJson,
    })
    return (await res.json()) as SubmitAck
  },

  workers: (s?: AbortSignal) =>
    getJson<{ workers: WorkerSummary[] }>('/api/v1/workers', s).then((r) => r.workers),

  // --- Worker detail (proxied through the coordinator by worker_id) ---
  worker: (id: string, s?: AbortSignal) =>
    getJson<WorkerSnapshot>(`/api/v1/workers/${id}/worker`, s),
  workerSubtasks: (id: string, s?: AbortSignal) =>
    getJson<{ subtasks: SubtaskRecord[] }>(`/api/v1/workers/${id}/subtasks`, s).then(
      (r) => r.subtasks,
    ),
  workerConfig: (id: string, s?: AbortSignal) =>
    getJson<WorkerConfig>(`/api/v1/workers/${id}/config`, s),
  workerMetrics: (id: string, s?: AbortSignal) => getText(`/api/v1/workers/${id}/metrics`, s),
  workerLogs: (id: string, q?: LogQuery, s?: AbortSignal) =>
    getJson<{ logs: LogRecord[] }>(logPath(`/api/v1/workers/${id}/logs`, q), s).then((r) => r.logs),

  // --- Logs + metrics (coordinator-local; the worker variants are proxied above) ---
  logs: (q?: LogQuery, s?: AbortSignal) =>
    getJson<{ logs: LogRecord[] }>(logPath('/api/v1/logs', q), s).then((r) => r.logs),
  logComponents: (s?: AbortSignal) =>
    getJson<{ components: string[] }>('/api/v1/logs/components', s).then((r) => r.components),
  metrics: (s?: AbortSignal) => getText('/metrics', s),

  // --- SQL workbench ---
  // The session catalog (tables/views registered via /api/v1/jobs/sql DDL).
  catalog: (s?: AbortSignal) =>
    getJson<{ tables: CatalogTable[] }>('/api/v1/catalog', s).then((r) => r.tables),
  // The WITH(connector='...') vocabulary this build understands.
  connectors: (s?: AbortSignal) =>
    getJson<{ connectors: SqlConnector[] }>('/api/v1/connectors', s).then((r) => r.connectors),
  // Compile / explain / submit raw SQL. The body is plain SQL text; options ride
  // the query string, and on submit so do the recovery options (the same
  // parameters as /jobs/spec). A 400 (parse/bind/compile error) is NOT thrown -
  // the parsed {ok:false,error,position} body is returned so the editor can show it.
  runSql: async (
    sql: string,
    mode: SqlMode,
    opts: { parallelism?: number; name?: string; recovery?: RecoveryOptions } = {},
  ): Promise<SqlResult> => {
    const p = new URLSearchParams({ mode })
    if (opts.parallelism != null) p.set('parallelism', String(opts.parallelism))
    if (opts.name) p.set('name', opts.name)
    if (mode === 'submit') appendRecoveryParams(p, opts.recovery)
    let res: Response
    try {
      res = await fetch(`/api/v1/jobs/sql?${encodeQuery(p)}`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: sql,
      })
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network error' }
    }
    try {
      return (await res.json()) as SqlResult
    } catch {
      return { ok: false, error: `${res.status} ${res.statusText}` }
    }
  },
}

export const EVENTS_PATH = '/api/v1/events'
