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
  // The cluster protocol version the worker registered with. 0 is a peer that
  // predates the field; absent on a coordinator that predates it.
  protocol_version?: number
}

export interface ClusterSnapshot {
  // The engine's version (clink 0.14.0 on); absent on an older coordinator.
  version?: string
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
  // The checkpoint a graceful stop ended the job at; 0 or absent when it was not
  // stopped (absent on a coordinator before clink 0.15).
  stopped_at_checkpoint_id?: number
  // True for a job that ended under an earlier Coordinator and is known to this
  // one only from its history record (clink 0.15 on): it has no subtasks,
  // graph, lineage or checkpoint configuration to show, and no progress.
  from_history?: boolean
  // The name the job was submitted with (a SQL job's ?name=, a compiled job's
  // name). Empty for an unnamed job; absent on a coordinator that predates it.
  name?: string
  expected_completion: number
  completed_count: number
  completion_signalled: boolean
  cancel_requested: boolean
  error_count: number
  // RUNNING | COMPLETED_OK | FAILED | CANCELLED, the coordinator's own verdict.
  // Absent on a coordinator that predates it; deriveJobState falls back to the
  // flags above.
  status?: string
  // The end-to-end delivery guarantee the coordinator's analyser computed at
  // submit (see lib/guarantees.ts for the levels) and what limits it, e.g.
  // "sink 'file_text_sink'" or "checkpointing disabled". Absent on a
  // coordinator that predates them.
  delivery_guarantee?: string
  guarantee_limiting_factor?: string
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
  stopped_at_checkpoint_id?: number // as JobSummary
  from_history?: boolean // as JobSummary
  // The name the job was submitted with (a SQL job's ?name=, a compiled job's
  // name). Empty for an unnamed job; absent on a coordinator that predates it.
  name?: string
  expected_completion: number
  completed_count: number
  completion_signalled: boolean
  cancel_requested: boolean
  errors: string[]
  subtask_errors: SubtaskErrorRecord[]
  tasks: JobTask[]
  latest_completed_checkpoint_id: number
  pending_checkpoint_ids: number[]
  status?: string
  // The checkpoint configuration the job is RUNNING with. A job's recovery
  // behaviour is decided entirely by these: whether it checkpoints at all,
  // how often, where state goes, how many restarts it gets. All absent on a
  // coordinator that predates them.
  checkpoint_dir?: string // empty = no checkpointing
  checkpoint_interval_ms?: number
  state_backend_uri?: string // empty = the coordinator's default backend
  restore_from_dir?: string // empty = a fresh start
  restore_from_checkpoint_id?: number
  max_restarts_on_worker_loss?: number
  // clink 0.15 on: the job left the restart budget to the default, which
  // max_restarts_on_worker_loss reports resolved.
  max_restarts_on_worker_loss_auto?: boolean
  unaligned_checkpoints?: boolean
  adaptive_barrier_mode?: boolean // the coordinator picks aligned/unaligned per trigger
  // As JobSummary, plus the analyser's full reasoning and its warnings.
  delivery_guarantee?: string
  guarantee_limiting_factor?: string
  guarantee_reasons?: string[]
  guarantee_warnings?: string[]
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

// SSE event from /api/v1/events. The `type` is the SSE event name (see
// EVENT_TYPES in hooks/useEvents.ts for the names the coordinator publishes);
// `data` is the raw payload string (often JSON or a short descriptor).
export interface ClinkEvent {
  id: string
  type: string
  data: string
  ts: number // client receive time (ms)
}

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

// One capability record the build declares for a connector variant
// (connectors::ConnectorCapabilities), e.g. kafka, kafka_2pc, postgres_upsert.
// `delivery` is the per-connector vocabulary (at_least_once,
// exactly_once_two_phase_commit, ...; see lib/guarantees.ts), not the job's
// end-to-end level.
export interface ConnectorVariant {
  name: string
  source: boolean
  sink: boolean
  delivery: string
  transactional: boolean
  commit_recoverable: boolean
  replayable: boolean
  offset_model: string // none | file_offset | log_offset | lsn | timestamp | opaque_token
  checkpoint_integrated: boolean
  tls: boolean
  available_in_sql: boolean
}

export interface SqlConnector {
  name: string
  source: boolean
  sink: boolean
  category: ConnectorCategory | string
  // Whether THIS coordinator binary was built with the connector. Absent on a
  // coordinator that predates the field (treat as unknown, not as false).
  available?: boolean
  // Declared capabilities, grouped under the vocabulary entry by the
  // coordinator: the strongest sink guarantee among the connector's records,
  // whether a source record replays from a recorded position, whether any
  // record offers TLS, and the records themselves. Absent on a coordinator
  // that predates them.
  sink_delivery?: string
  source_replayable?: boolean
  tls?: boolean
  variants?: ConnectorVariant[]
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

// Presentation job state. The coordinator reports its own verdict as
// `status` (RUNNING / COMPLETED_OK / FAILED / CANCELLED); that wins when
// present, and the flags reconstruct it on a coordinator that predates the
// field, with the same precedence (failed > cancelled > completed > running).
// A job a graceful stop ended (stopped_at_checkpoint_id, clink 0.15 on) reports
// COMPLETED_OK, the same as one that ran out of input, and reads as stopped.
export type JobState = 'running' | 'completed' | 'stopped' | 'cancelled' | 'failed'

const SERVER_STATUS: Record<string, JobState> = {
  RUNNING: 'running',
  COMPLETED_OK: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export function deriveJobState(j: {
  cancel_requested: boolean
  completion_signalled: boolean
  error_count?: number
  errors?: string[]
  status?: string
  stopped_at_checkpoint_id?: number
}): JobState {
  const reported = j.status ? SERVER_STATUS[j.status] : undefined
  const stopped = (j.stopped_at_checkpoint_id ?? 0) > 0
  if (reported) return reported === 'completed' && stopped ? 'stopped' : reported
  const errs = j.error_count ?? j.errors?.length ?? 0
  if (errs > 0) return 'failed'
  if (j.cancel_requested) return 'cancelled'
  if (j.completion_signalled) return stopped ? 'stopped' : 'completed'
  return 'running'
}
