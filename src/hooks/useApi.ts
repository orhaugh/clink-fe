import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type LogQuery } from '@/lib/api'
import type { RecoveryOptions } from '@/lib/recovery'
import type { SqlMode } from '@/lib/types'

// Poll cadences tuned for an ops console: cluster topology a few seconds,
// detail views a touch faster, metrics a little slower. SSE events also
// invalidate the topology queries for near-instant updates (see useEvents).
const TOPOLOGY = 4000
const DETAIL = 3000
const METRICS = 5000

export const qk = {
  health: ['health'] as const,
  cluster: ['cluster'] as const,
  coordinatorConfig: ['coordinatorConfig'] as const,
  jobs: ['jobs'] as const,
  job: (id: number) => ['job', id] as const,
  jobGraph: (id: number) => ['jobGraph', id] as const,
  jobOperators: (id: number) => ['jobOperators', id] as const,
  jobLineage: (id: number) => ['jobLineage', id] as const,
  workers: ['workers'] as const,
  worker: (id: string) => ['worker', id] as const,
  workerSubtasks: (id: string) => ['workerSubtasks', id] as const,
  workerConfig: (id: string) => ['workerConfig', id] as const,
  workerMetrics: (id: string) => ['workerMetrics', id] as const,
  workerLogs: (id: string, q: LogQuery) => ['workerLogs', id, q] as const,
  logs: (q: LogQuery) => ['logs', q] as const,
  logComponents: ['logComponents'] as const,
  metrics: ['metrics'] as const,
  catalog: ['catalog'] as const,
  connectors: ['connectors'] as const,
}

export const useHealth = () =>
  useQuery({
    queryKey: qk.health,
    queryFn: ({ signal }) => api.health(signal),
    refetchInterval: TOPOLOGY,
  })

export const useCluster = () =>
  useQuery({
    queryKey: qk.cluster,
    queryFn: ({ signal }) => api.cluster(signal),
    refetchInterval: TOPOLOGY,
  })

export const useCoordinatorConfig = () =>
  useQuery({
    queryKey: qk.coordinatorConfig,
    queryFn: ({ signal }) => api.coordinatorConfig(signal),
  })

export const useJobs = () =>
  useQuery({
    queryKey: qk.jobs,
    queryFn: ({ signal }) => api.jobs(signal),
    refetchInterval: TOPOLOGY,
  })

export const useJob = (id: number) =>
  useQuery({
    queryKey: qk.job(id),
    queryFn: ({ signal }) => api.job(id, signal),
    refetchInterval: DETAIL,
  })

export const useJobGraph = (id: number) =>
  useQuery({
    queryKey: qk.jobGraph(id),
    queryFn: ({ signal }) => api.jobGraph(id, signal),
    // Topology is structural; poll slowly (placement can shift on rescale).
    refetchInterval: 8000,
  })

// Per-operator runtime stats: polled FAST and decoupled from the slow topology
// poll, so the node overlays (records/sec, backpressure) feel live. Each poll
// scrapes the workers coordinator-side, so 2s is a reasonable floor.
export const useJobOperators = (id: number, enabled = true) =>
  useQuery({
    queryKey: qk.jobOperators(id),
    queryFn: ({ signal }) => api.jobOperators(id, signal),
    refetchInterval: 2000,
    enabled,
  })

// Lineage is a pure function of the submitted spec, so once the coordinator
// reports it, it never changes over a job's life: fetch once, no polling. Until
// it is available (the job's graph not yet retained) keep asking, and the
// coordinator.job_lineage SSE event invalidates it as well (see useEvents).
export const useJobLineage = (id: number) =>
  useQuery({
    queryKey: qk.jobLineage(id),
    queryFn: ({ signal }) => api.jobLineage(id, signal),
    staleTime: Infinity,
    refetchInterval: (q) => (q.state.data?.available ? false : 5000),
  })

export const useWorkers = () =>
  useQuery({
    queryKey: qk.workers,
    queryFn: ({ signal }) => api.workers(signal),
    refetchInterval: TOPOLOGY,
  })

export const useWorker = (id: string) =>
  useQuery({
    queryKey: qk.worker(id),
    queryFn: ({ signal }) => api.worker(id, signal),
    refetchInterval: DETAIL,
  })

export const useWorkerSubtasks = (id: string) =>
  useQuery({
    queryKey: qk.workerSubtasks(id),
    queryFn: ({ signal }) => api.workerSubtasks(id, signal),
    refetchInterval: DETAIL,
  })

export const useWorkerConfig = (id: string) =>
  useQuery({ queryKey: qk.workerConfig(id), queryFn: ({ signal }) => api.workerConfig(id, signal) })

export const useWorkerMetricsText = (id: string, enabled = true) =>
  useQuery({
    queryKey: qk.workerMetrics(id),
    queryFn: ({ signal }) => api.workerMetrics(id, signal),
    refetchInterval: METRICS,
    enabled,
  })

export const useMetricsText = (enabled = true) =>
  useQuery({
    queryKey: qk.metrics,
    queryFn: ({ signal }) => api.metrics(signal),
    refetchInterval: METRICS,
    enabled,
  })

export const useLogComponents = () =>
  useQuery({
    queryKey: qk.logComponents,
    queryFn: ({ signal }) => api.logComponents(signal),
    refetchInterval: 15000,
  })

export const useLogs = (q: LogQuery, refetchInterval: number | false = 3000) =>
  useQuery({ queryKey: qk.logs(q), queryFn: ({ signal }) => api.logs(q, signal), refetchInterval })

export const useWorkerLogs = (id: string, q: LogQuery, refetchInterval: number | false = 3000) =>
  useQuery({
    queryKey: qk.workerLogs(id, q),
    queryFn: ({ signal }) => api.workerLogs(id, q, signal),
    refetchInterval,
  })

export function useCancelJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.cancelJob(id),
    onSuccess: (_ack, id) => {
      void qc.invalidateQueries({ queryKey: qk.job(id) })
      void qc.invalidateQueries({ queryKey: qk.jobs })
    },
  })
}

export function useSavepointJob() {
  return useMutation({
    mutationFn: ({ id, timeoutMs }: { id: number; timeoutMs?: number }) =>
      api.savepointJob(id, timeoutMs),
  })
}

export function useRescaleJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      roleParallelism,
    }: {
      id: number
      roleParallelism: Record<string, number>
    }) => api.rescaleJob(id, roleParallelism),
    onSuccess: (_ack, { id }) => {
      void qc.invalidateQueries({ queryKey: qk.job(id) })
      void qc.invalidateQueries({ queryKey: qk.jobs })
      void qc.invalidateQueries({ queryKey: qk.cluster })
    },
  })
}

export function useSubmitJobSo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      name,
      recovery,
    }: {
      file: File
      name?: string
      recovery?: RecoveryOptions
    }) => api.submitJobSo(file, name, recovery),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.jobs }),
  })
}

export function useSubmitSpec() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      spec,
      name,
      recovery,
    }: {
      spec: string
      name?: string
      recovery?: RecoveryOptions
    }) => api.submitSpec(spec, name, recovery),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.jobs }),
  })
}

// --- SQL workbench ---

export const useCatalog = (refetchInterval: number | false = 5000) =>
  useQuery({
    queryKey: qk.catalog,
    queryFn: ({ signal }) => api.catalog(signal),
    refetchInterval,
  })

export const useConnectors = () =>
  useQuery({
    queryKey: qk.connectors,
    queryFn: ({ signal }) => api.connectors(signal),
    staleTime: 5 * 60 * 1000, // the build's connector set does not change at runtime
  })

// runSql is a mutation (it has side effects: DDL mutates the session catalog,
// submit creates jobs). On success we refresh the catalog (DDL may have changed
// it) and, for submit, the jobs list.
export function useRunSql() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      sql,
      mode,
      parallelism,
      name,
      recovery,
    }: {
      sql: string
      mode: SqlMode
      parallelism?: number
      name?: string
      recovery?: RecoveryOptions
    }) => api.runSql(sql, mode, { parallelism, name, recovery }),
    onSuccess: (res, { mode }) => {
      void qc.invalidateQueries({ queryKey: qk.catalog })
      if (mode === 'submit' && res.ok) {
        void qc.invalidateQueries({ queryKey: qk.jobs })
        void qc.invalidateQueries({ queryKey: qk.cluster })
      }
    },
  })
}
