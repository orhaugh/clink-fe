import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type LogQuery } from '@/lib/api'

// Poll cadences tuned for an ops console: cluster topology a few seconds,
// detail views a touch faster, metrics a little slower. SSE events also
// invalidate the topology queries for near-instant updates (see useEvents).
const TOPOLOGY = 4000
const DETAIL = 3000
const METRICS = 5000

export const qk = {
  health: ['health'] as const,
  cluster: ['cluster'] as const,
  jmConfig: ['jmConfig'] as const,
  jobs: ['jobs'] as const,
  job: (id: number) => ['job', id] as const,
  tms: ['tms'] as const,
  tm: (id: string) => ['tm', id] as const,
  tmSubtasks: (id: string) => ['tmSubtasks', id] as const,
  tmConfig: (id: string) => ['tmConfig', id] as const,
  tmMetrics: (id: string) => ['tmMetrics', id] as const,
  tmLogs: (id: string, q: LogQuery) => ['tmLogs', id, q] as const,
  logs: (q: LogQuery) => ['logs', q] as const,
  logComponents: ['logComponents'] as const,
  metrics: ['metrics'] as const,
}

export const useHealth = () =>
  useQuery({ queryKey: qk.health, queryFn: ({ signal }) => api.health(signal), refetchInterval: TOPOLOGY })

export const useCluster = () =>
  useQuery({ queryKey: qk.cluster, queryFn: ({ signal }) => api.cluster(signal), refetchInterval: TOPOLOGY })

export const useJmConfig = () =>
  useQuery({ queryKey: qk.jmConfig, queryFn: ({ signal }) => api.jmConfig(signal) })

export const useJobs = () =>
  useQuery({ queryKey: qk.jobs, queryFn: ({ signal }) => api.jobs(signal), refetchInterval: TOPOLOGY })

export const useJob = (id: number) =>
  useQuery({ queryKey: qk.job(id), queryFn: ({ signal }) => api.job(id, signal), refetchInterval: DETAIL })

export const useTms = () =>
  useQuery({ queryKey: qk.tms, queryFn: ({ signal }) => api.tms(signal), refetchInterval: TOPOLOGY })

export const useTm = (id: string) =>
  useQuery({ queryKey: qk.tm(id), queryFn: ({ signal }) => api.tm(id, signal), refetchInterval: DETAIL })

export const useTmSubtasks = (id: string) =>
  useQuery({
    queryKey: qk.tmSubtasks(id),
    queryFn: ({ signal }) => api.tmSubtasks(id, signal),
    refetchInterval: DETAIL,
  })

export const useTmConfig = (id: string) =>
  useQuery({ queryKey: qk.tmConfig(id), queryFn: ({ signal }) => api.tmConfig(id, signal) })

export const useTmMetricsText = (id: string, enabled = true) =>
  useQuery({
    queryKey: qk.tmMetrics(id),
    queryFn: ({ signal }) => api.tmMetrics(id, signal),
    refetchInterval: METRICS,
    enabled,
  })

export const useMetricsText = (enabled = true) =>
  useQuery({ queryKey: qk.metrics, queryFn: ({ signal }) => api.metrics(signal), refetchInterval: METRICS, enabled })

export const useLogComponents = () =>
  useQuery({ queryKey: qk.logComponents, queryFn: ({ signal }) => api.logComponents(signal), refetchInterval: 15000 })

export const useLogs = (q: LogQuery, refetchInterval: number | false = 3000) =>
  useQuery({ queryKey: qk.logs(q), queryFn: ({ signal }) => api.logs(q, signal), refetchInterval })

export const useTmLogs = (id: string, q: LogQuery, refetchInterval: number | false = 3000) =>
  useQuery({
    queryKey: qk.tmLogs(id, q),
    queryFn: ({ signal }) => api.tmLogs(id, q, signal),
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
    mutationFn: ({ id, timeoutMs }: { id: number; timeoutMs?: number }) => api.savepointJob(id, timeoutMs),
  })
}

export function useRescaleJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, roleParallelism }: { id: number; roleParallelism: Record<string, number> }) =>
      api.rescaleJob(id, roleParallelism),
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
    mutationFn: ({ file, name }: { file: File; name?: string }) => api.submitJobSo(file, name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.jobs }),
  })
}

export function useSubmitSpec() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ spec, name }: { spec: string; name?: string }) => api.submitSpec(spec, name),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.jobs }),
  })
}
