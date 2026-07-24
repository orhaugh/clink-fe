// TypeScript models mirroring clink's HTTP API exactly. Field names and types
// are taken from the JSON writers in tools/clink_node.cpp and the snapshot
// structs in include/clink/cluster/snapshots.hpp. See docs/clink-api.md.

export interface Health {
  role: string // "coordinator" | "worker"
  ok: boolean
  uptime_s: number
  bound_port: number
}

export interface WorkerSummary {
  worker_id: string
  data_host: string
  slot_capacity: number
  slots_in_use: number
  lost: boolean
  http_port: number // 0 = worker not exposing HTTP (detail/logs/metrics unreachable)
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
  workers: WorkerSummary[]
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
  worker_id: string
}

export interface SubtaskErrorRecord {
  role: string
  subtask_idx: number
  worker_id: string
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

export interface GraphSubtaskPlacement {
  subtask_idx: number
  worker_id: string
  started_at_unix_ms?: number
  finished_at_unix_ms?: number
}

export interface GraphNode {
  id: string
  op_type: string
  display_name: string
  uid: string
  kind: 'source' | 'operator' | 'sink' | string
  parallelism: number
  out_channel: string
  keyed: boolean
  subtasks: GraphSubtaskPlacement[]
}

export interface GraphEdge {
  from: string
  to: string
  routing: 'forward' | 'hash' | 'rebalance' | string
  channel: string
}

export interface JobGraphDetail {
  job_id: number
  topology_version: number
  available: boolean
  nodes: GraphNode[]
  edges: GraphEdge[]
}

// Per-operator runtime stats (GET /api/v1/jobs/:id/operators). Aggregated by
// the coordinator across every worker hosting the job; the finest separable granularity is
// per-worker (the host registry is shared across a worker's subtasks), so per_worker rows
// accompany the node-level totals while subtasks[] carries the exact placement.
export interface OperatorWorkerRow {
  worker_id: string
  records_in: number
  records_out: number
  input_depth: number
  input_capacity: number
}

export interface OperatorRuntime {
  node: string
  op_id: string
  uid: string
  kind: 'source' | 'operator' | 'sink' | string
  op_type: string
  display_name: string
  parallelism: number
  keyed: boolean
  metrics_available: boolean
  stale: boolean
  records_in: number
  records_out: number
  records_dropped: number
  side_output: number
  bytes_sent: number
  bytes_received: number
  input_depth: number
  input_capacity: number
  has_watermark: boolean
  watermark_ms?: number
  accumulators: Record<string, number>
  subtasks: GraphSubtaskPlacement[]
  per_worker: OperatorWorkerRow[]
}

export interface JobOperators {
  job_id: number
  available: boolean
  operators: OperatorRuntime[]
}

// Data lineage (GET /api/v1/jobs/:id/lineage). A graph of the external
// datasets the job reads and writes: vertices are source/sink connectors,
// datasets identify the external entity (namespace = storage address, name =
// topic/table/path), edges are coarse source -> sink reachability through the
// DAG. Shaped after the OpenLineage data model.
export interface LineageSchemaField {
  name: string
  type: string
}

export interface LineageColumnInput {
  namespace: string
  name: string
  field: string
}

// Per-output-column lineage on sink datasets (SQL jobs only).
// transformation: 'IDENTITY' | 'TRANSFORMATION' | 'AGGREGATION'; empty inputs
// means no traceable source (e.g. COUNT(*)).
export interface LineageColumnField {
  output: string
  transformation?: string
  inputs: LineageColumnInput[]
}

export interface LineageDataset {
  namespace: string
  name: string
  facets: Record<string, string>
  schema?: LineageSchemaField[]
  column_lineage?: LineageColumnField[]
}

export interface LineageVertex {
  id: string
  uid: string
  name: string
  op_type: string
  boundedness?: 'bounded' | 'unbounded' | 'unknown' | string
  datasets: LineageDataset[]
}

export interface LineageGraph {
  sources: LineageVertex[]
  sinks: LineageVertex[]
  edges: Array<{ from: string; to: string }>
}

export interface JobLineage {
  job_id: number
  available: boolean
  lineage: LineageGraph
}

export interface WorkerSnapshot {
  worker_id: string
  data_host: string
  slot_capacity: number
  slots_in_use: number
  coordinator_host: string
  coordinator_port: number
  active_subtasks: number
}

export interface SubtaskRecord {
  job_id: number
  role: string
  subtask_idx: number
  status: string // "pending" | "ready"
}

export interface CoordinatorConfig {
  bind_host: string
  advertise_host: string
  heartbeat_timeout_ms: number
  watchdog_interval_ms: number
  submit_wait_for_slots_ms: number
  restart_drain_timeout_ms: number
}

export interface WorkerConfig {
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
// (coordinator.worker_registered, coordinator.job_submitted, coordinator.job_completed, coordinator.worker_lost); `data`
// is the raw payload string (often JSON or a short descriptor).
export interface ClinkEvent {
  id: string
  type: string
  data: string
  ts: number // client receive time (ms)
}

// Derived, presentation-only job state (the API does not expose a single
// --- SQL workbench (GET /api/v1/catalog, /api/v1/connectors,
//     POST /api/v1/jobs/sql) -------------------------------------------------

export interface CatalogColumn {
  name: string
  type: string // arrow type, e.g. "int64", "string"
}

export type CatalogKind = 'table' | 'view' | 'materialized_view' | 'lookup'

export interface CatalogTable {
  name: string
  kind: CatalogKind | string
  connector?: string
  columns: CatalogColumn[]
  primary_key?: string[]
}

export type ConnectorCategory = 'messaging' | 'storage' | 'database' | 'observability' | 'testing'

export interface SqlConnector {
  name: string
  source: boolean
  sink: boolean
  category: ConnectorCategory | string
}

export type SqlMode = 'explain' | 'compile' | 'submit'

export interface SqlPlanEntry {
  kind: string // "insert" | "select" | "materialized_view"
  explain: string
}

export interface SqlSpecEntry {
  name: string
  spec_json: string
}

export interface SqlJobEntry {
  name: string
  job_id: number
}

// Response of POST /api/v1/jobs/sql. On success `ok` is true and exactly one of
// plans/specs/jobs is populated per the mode; on a parse/bind/compile error
// `ok` is false with a message and 1-based byte `position` (0 if unknown).
export interface SqlResult {
  ok: boolean
  mode?: SqlMode
  applied?: number // DDL statements applied to the session catalog
  plans?: SqlPlanEntry[]
  specs?: SqlSpecEntry[]
  jobs?: SqlJobEntry[]
  error?: string
  position?: number
}

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
