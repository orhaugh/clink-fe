// TypeScript models mirroring clink's HTTP API exactly. Field names and types
// are taken from the JSON writers in tools/clink_node.cpp and the snapshot
// structs in include/clink/cluster/snapshots.hpp. See docs/clink-api.md.

export interface Health {
  role: string // "jm" | "tm"
  ok: boolean
  uptime_s: number
  bound_port: number
}

export interface TmSummary {
  tm_id: string
  data_host: string
  slot_capacity: number
  slots_in_use: number
  lost: boolean
  http_port: number // 0 = TM not exposing HTTP (detail/logs/metrics unreachable)
}

export interface ClusterSnapshot {
  bind_host: string
  advertise_host: string
  control_port: number
  total_slot_capacity: number
  slots_in_use: number
  jobs_total: number
  jobs_running: number
  jobs_completed: number
  task_managers: TmSummary[]
}

export interface JobSummary {
  id: number
  expected_completion: number
  completed_count: number
  completion_signalled: boolean
  cancel_requested: boolean
  error_count: number
}

export interface JobTask {
  role: string
  subtask_idx: number
  tm_id: string
}

export interface SubtaskErrorRecord {
  role: string
  subtask_idx: number
  tm_id: string
  attempt: number // job restart generation at time of failure (0 = first run)
  ts_ms: number
  message: string // operator exception text; includes a capture-site stack trace where available
}

export interface JobDetail {
  id: number
  expected_completion: number
  completed_count: number
  completion_signalled: boolean
  cancel_requested: boolean
  errors: string[]
  subtask_errors: SubtaskErrorRecord[]
  tasks: JobTask[]
  latest_completed_checkpoint_id: number
  pending_checkpoint_ids: number[]
}

export interface TmSnapshot {
  tm_id: string
  data_host: string
  slot_capacity: number
  slots_in_use: number
  jm_host: string
  jm_port: number
  active_subtasks: number
}

export interface SubtaskRecord {
  job_id: number
  role: string
  subtask_idx: number
  status: string // "pending" | "ready"
}

export interface JmConfig {
  bind_host: string
  advertise_host: string
  heartbeat_timeout_ms: number
  watchdog_interval_ms: number
  submit_wait_for_slots_ms: number
  restart_drain_timeout_ms: number
}

export interface TmConfig {
  slot_count: number
  heartbeat_interval_ms: number
}

export interface LogRecord {
  ts_ms: number
  level: 'debug' | 'info' | 'warn' | 'error' | string
  source: string
  message: string
}

export interface SubmitAck {
  ok: boolean
  job_id?: number
  name?: string
  error?: string
}

export interface CancelAck {
  job_id: number
  ok: boolean
  message: string
}

export interface SavepointAck {
  job_id: number
  ok: boolean
  checkpoint_id: number
  checkpoint_dir: string
  message: string
}

export interface RescaleAck {
  job_id: number
  ok: boolean
  message: string
}

// SSE event from /api/v1/events. The `type` is the SSE event name
// (jm.tm_registered, jm.job_submitted, jm.job_completed, jm.tm_lost); `data`
// is the raw payload string (often JSON or a short descriptor).
export interface ClinkEvent {
  id: string
  type: string
  data: string
  ts: number // client receive time (ms)
}

// Derived, presentation-only job state (the API does not expose a single
// status enum; we infer it from the summary flags + error count).
export type JobState = 'running' | 'completed' | 'cancelled' | 'failed'

export function deriveJobState(j: {
  cancel_requested: boolean
  completion_signalled: boolean
  error_count?: number
  errors?: string[]
}): JobState {
  const errs = j.error_count ?? j.errors?.length ?? 0
  if (errs > 0) return 'failed'
  if (j.cancel_requested) return 'cancelled'
  if (j.completion_signalled) return 'completed'
  return 'running'
}
