# clink HTTP API (frontend source of truth)

The console is built strictly against the endpoints below, as registered in
`tools/clink_node.cpp` and serialised by the writer helpers there plus the
snapshot structs in `include/clink/cluster/snapshots.hpp`. Types here mirror
`src/lib/types.ts`.

All routes are relative; the Coordinator is the single origin. The coordinator proxies
per-Worker routes under `/api/v1/workers/:id/*`, so the console only targets the
coordinator. By default the server sends no CORS headers, so the browser must reach it
same-origin (dev: the Vite proxy; prod: serve the SPA from the coordinator); for a
cross-origin deployment start the node with `--http-cors-origin=<origin>`.

## Coordinator endpoints

| Method | Path                           | Response                                                                                                                                                                           |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/health`               | `{ role, ok, uptime_s, bound_port }`                                                                                                                                               |
| GET    | `/api/v1/cluster`              | `ClusterSnapshot` (rollup + embedded `workers: WorkerSummary[]`)                                                                                                                   |
| GET    | `/api/v1/config`               | `{ bind_host, advertise_host, heartbeat_timeout_ms, watchdog_interval_ms, submit_wait_for_slots_ms, restart_drain_timeout_ms }`                                                    |
| GET    | `/api/v1/jobs`                 | `{ jobs: JobSummary[] }`                                                                                                                                                           |
| GET    | `/api/v1/jobs/:id`             | `JobDetail` (404 `{error}` if unknown)                                                                                                                                             |
| GET    | `/api/v1/jobs/:id/graph`       | `JobGraphDetail` (logical topology: `nodes`, `edges`, `available`, `topology_version`)                                                                                             |
| GET    | `/api/v1/jobs/:id/operators`   | `{ job_id, available, operators: OperatorRuntime[] }` per-operator runtime stats, aggregated across workers                                                                        |
| GET    | `/api/v1/jobs/:id/lineage`     | `{ job_id, available, lineage: { sources, sinks, edges } }` external-dataset lineage (404 if unknown)                                                                              |
| POST   | `/api/v1/jobs`                 | multipart: file part `job_so` (+ optional text `job_name`), `?name=` plus the recovery parameters below → `{ ok, job_id, name }` or `{ error }`                                    |
| POST   | `/api/v1/jobs/spec`            | JSON body (JobGraphSpec), `?name=` plus the recovery parameters below → `{ ok, job_id, name }`                                                                                     |
| POST   | `/api/v1/jobs/:id/cancel`      | `{ job_id, ok, message }` (404/409 on unknown/already-complete/in-progress)                                                                                                        |
| POST   | `/api/v1/jobs/:id/savepoint`   | `?timeout_ms=` → `{ job_id, ok, checkpoint_id, checkpoint_dir, message }` (404/409 on failure)                                                                                     |
| POST   | `/api/v1/jobs/:id/rescale`     | JSON body `{ "<role>": <parallelism>, ... }` (scale-up only) → `{ job_id, ok, message }`                                                                                           |
| POST   | `/api/v1/jobs/sql`             | raw SQL body; `?mode=explain\|compile\|submit&parallelism&name` (+ the recovery parameters on submit) → `SqlResult` (400 body `{ok:false,error,position}` is returned, not thrown) |
| GET    | `/api/v1/catalog`              | `{ tables: CatalogTable[] }` session catalog (tables/views registered via SQL DDL)                                                                                                 |
| GET    | `/api/v1/connectors`           | `{ connectors: SqlConnector[] }` the `WITH(connector='...')` vocabulary, with availability and the declared capability records                                                     |
| GET    | `/api/v1/workers`              | `{ workers: WorkerSummary[] }`                                                                                                                                                     |
| GET    | `/api/v1/workers/:id/worker`   | `WorkerSnapshot` (proxied)                                                                                                                                                         |
| GET    | `/api/v1/workers/:id/subtasks` | `{ subtasks: SubtaskRecord[] }` (proxied)                                                                                                                                          |
| GET    | `/api/v1/workers/:id/config`   | `{ slot_count, heartbeat_interval_ms }` (proxied)                                                                                                                                  |
| GET    | `/api/v1/workers/:id/metrics`  | Prometheus text (proxied)                                                                                                                                                          |
| GET    | `/api/v1/workers/:id/logs`     | `{ logs: LogRecord[] }` (proxied)                                                                                                                                                  |
| GET    | `/api/v1/logs`                 | `{ logs: LogRecord[] }`; `?level&limit&since_ms&source`                                                                                                                            |
| GET    | `/api/v1/logs/components`      | `{ components: string[] }`                                                                                                                                                         |
| GET    | `/metrics`                     | Prometheus exposition text (incl. system gauges, below)                                                                                                                            |
| GET    | `/api/v1/events`               | SSE; event names `coordinator.worker_registered`, `coordinator.worker_lost`, `coordinator.job_submitted`, `coordinator.job_lineage`, `coordinator.job_completed`                   |

Proxy routes return 404 if the worker is unknown/lost/has no HTTP listener, 502 if
unreachable.

## Worker endpoints (also served locally on each worker)

`/api/v1/health`, `/api/v1/worker` (`WorkerSnapshot`), `/api/v1/worker/subtasks`
(`{ subtasks }`), `/api/v1/config` (`{ slot_count, heartbeat_interval_ms }`),
`/metrics`, `/api/v1/logs`, `/api/v1/logs/components`, `/api/v1/events`.

## Shapes

```
WorkerSummary    { worker_id, data_host, slot_capacity, slots_in_use, lost, http_port,
                   protocol_version }                 // 0 = predates the field
ClusterSnapshot { version?, bind_host, advertise_host, control_port, total_slot_capacity,
                  slots_in_use, jobs_total, jobs_running, jobs_completed,
                  workers: WorkerSummary[] }
JobSummary   { id, name?, expected_completion, completed_count, completion_signalled,
               cancel_requested, error_count,
               status,                                 // RUNNING | COMPLETED_OK | FAILED | CANCELLED
               delivery_guarantee, guarantee_limiting_factor }
JobDetail    { id, name?, expected_completion, completed_count, completion_signalled,
               cancel_requested, errors: string[],
               subtask_errors: { role, subtask_idx, worker_id, attempt, ts_ms, message }[],
               tasks: { role, subtask_idx, worker_id }[],
               latest_completed_checkpoint_id, pending_checkpoint_ids: number[],
               status,
               // the checkpoint configuration the job is RUNNING with
               checkpoint_dir, checkpoint_interval_ms, state_backend_uri,
               restore_from_dir, restore_from_checkpoint_id,
               max_restarts_on_worker_loss, unaligned_checkpoints, adaptive_barrier_mode,
               // the analyser's verdict at submit, and why
               delivery_guarantee, guarantee_limiting_factor,
               guarantee_reasons: string[], guarantee_warnings: string[] }
WorkerSnapshot   { worker_id, data_host, slot_capacity, slots_in_use, coordinator_host, coordinator_port,
               active_subtasks }
SubtaskRecord{ job_id, role, subtask_idx, status }   // status: "pending" | "ready"
LogRecord    { ts_ms, level, source, message }       // level: debug|info|warn|error
LineageGraph { sources: LineageVertex[], sinks: LineageVertex[],
               edges: { from, to }[] }               // vertex ids
LineageVertex{ id, uid, name, op_type, boundedness?, // boundedness on sources only
               datasets: { namespace, name, facets: {k:v},
                           schema?: { name, type }[],
                           column_lineage?: { output, transformation?,
                                              inputs: { namespace, name, field }[] }[] }[] }
```

`name` is the name the job was submitted with (a SQL job's `?name=`, a plugin
upload's `job_name`, a spec's `name`), empty for an unnamed job and absent on a
coordinator that predates it; the console shows it beside the job's number.

Progress: the coordinator counts finished subtasks against the job's total,
which reaches 100% only for a job whose input ends. A running job whose lineage
has a source with `boundedness: "unbounded"` is shown as streaming instead
(`lib/progress.ts`); an unknown boundedness keeps the share.

`status` is the coordinator's own verdict; `deriveJobState` uses it when
present and reconstructs it from `error_count`/`errors`, `cancel_requested`
and `completion_signalled` on a coordinator that predates the field.

`delivery_guarantee` is the end-to-end level the coordinator's analyser
computed when the job was submitted, the weakest link across source,
checkpointing and sinks: `END_TO_END_EXACTLY_ONCE`,
`EFFECTIVELY_ONCE_REQUIRES_IDEMPOTENT_KEY`,
`STATE_EXACTLY_ONCE_OUTPUT_AT_LEAST_ONCE`, `AT_LEAST_ONCE_SOURCE` (a source that
keeps no position and is redelivered what it did not acknowledge),
`AT_MOST_ONCE_SOURCE` or
`NO_RECOVERY_GUARANTEE`. `guarantee_limiting_factor` names what caps it
(`sink 'file_text_sink'`, `checkpointing disabled`; empty when nothing does).
The detail's `guarantee_reasons` is the analyser's reasoning, one line per
constraint, and `guarantee_warnings` what it could not verify. All of these,
and the checkpoint configuration fields, are absent on a coordinator that
predates them (clink 0.11.0 and earlier); the console shows a dash, never a
guessed value.

## Recovery parameters on submit

`POST /api/v1/jobs` (the plugin upload), `POST /api/v1/jobs/spec` and
`POST /api/v1/jobs/sql?mode=submit` take the job's checkpoint configuration on
the query string, parsed by the coordinator's `checkpoint_config_from_query`:

```
checkpoint_dir=<path>                 no checkpointing without it
checkpoint_interval_ms=<n>
state_backend=<uri>                   e.g. rocksdb:///var/lib/clink/state
max_restarts_on_worker_loss=<n>
alignment=aligned|unaligned|adaptive
restore_from_dir=<path>  restore_from_checkpoint_id=<n>
```

An unset parameter keeps the coordinator's default; a malformed one (a
negative or non-integer number, an unknown alignment) is refused with a 400
rather than silently defaulted. Without a `checkpoint_dir` the job never
checkpoints, so its exactly-once sinks never commit and a worker loss is not
recoverable, which is why the console's recovery panel always states the
consequence of the current choice. The plugin upload honours them from the
clink change that added them to that route; an older coordinator ignores them
there and runs the job with its defaults, which is why the console's upload
form points at the job's recovery card. The console serialises the values
with `encodeURIComponent` so a `+` inside a backend URI survives.

## Backend follow-ups (now landed)

These were previously gaps; the clink backend now supports them:

- **Structured failures + stack traces.** `GET /api/v1/jobs/:id` now returns
  `subtask_errors[]` (role, subtask_idx, worker_id, attempt, ts_ms, message)
  alongside the flat `errors[]`. Where the node toolchain has C++23
  `std::stacktrace` (GCC builds), the executor appends a capture-site trace to
  the message. Honest limitation: the trace is taken in the runner thread
  post-unwind, so it shows the runner to operator call chain, not the exact
  throw frame. On toolchains without `<stacktrace>` (macOS/libc++) the message
  carries the exception text only.
- **Savepoint / rescale over HTTP.** `POST /api/v1/jobs/:id/savepoint` and
  `/rescale` wrap the same coordinator operations as `clink_savepoint` /
  `clink_rescale_job`. Both are synchronous; rescale is scale-up only.
- **CORS.** Start the node with `--http-cors-origin=<origin>` (e.g. `*`) to send
  `Access-Control-Allow-*` and answer OPTIONS preflight, so a standalone console
  can call the API cross-origin without the dev proxy.
- **Engine version.** `GET /api/v1/cluster` carries `version`, the engine's
  release (clink 0.14.0 on); the sidebar shows it beside the console's own.
- **Token.** A node started with `CLINK_AUTH_TOKEN` answers every API request
  without `Authorization: Bearer <token>` with 401. A Coordinator serves a
  mounted console's own files without it (they hold no cluster data). The
  console asks for the token on the first 401 (`ErrorState` renders
  `TokenForm`), keeps it in `sessionStorage` for the tab, and sends it on every
  request through `lib/auth.ts`. `EventSource` cannot send a header, so with a
  token set `useEvents` reads `/api/v1/events` through fetch (`lib/sse.ts`) and
  reconnects with a back-off; without one it keeps `EventSource`.

## System metrics

Both coordinator and worker `/metrics` carry per-process resource gauges, sampled on each
scrape (Linux `/proc`, macOS mach; degrade silently where unavailable):

```
clink_process_resident_memory_bytes   gauge   RSS (physical) bytes
clink_process_virtual_memory_bytes    gauge   virtual size bytes
clink_process_cpu_ms_total            counter cumulative CPU (user+sys) ms
clink_process_cpu_percent             gauge   CPU % over the last scrape interval (>100 = multi-core)
clink_process_open_fds                gauge   open file descriptors
clink_process_threads                 gauge   live threads
clink_disk_total_bytes{volume}        gauge   filesystem capacity, per volume
clink_disk_free_bytes{volume}         gauge   available bytes, per volume
clink_disk_used_bytes{volume}         gauge   used bytes, per volume
```

Disk gauges carry a `volume` label: `workdir` (the node's working directory)
and, when the node is started with `--metrics-disk-path=<path>` (the coordinator defaults
this to `--ha-dir`), `checkpoint` for the checkpoint/state mount. Volumes on the
same filesystem are de-duplicated, so a single-disk node reports one `workdir`
volume. The console renders one disk card per volume.

The console renders these as a System card row on the Metrics page (coordinator) and each
Worker's metrics tab, plus a rolling CPU/memory session chart.

## SQL workbench (when the coordinator is built with SQL linked)

The SQL workbench page (`/sql`) authors and runs SQL server-side; the browser
never parses SQL. Three endpoints back it (present only when `CLINK_LINKED_SQL`).

```
POST /api/v1/jobs/sql?mode=explain|compile|submit[&parallelism=N][&name=foo]
```

The request body is raw SQL text (one or more statements; `text/plain`, no JSON
wrapper, so quoting is untouched). DDL (`CREATE TABLE`/`VIEW`, `ALTER`, `RENAME`,
`DROP`) is applied to a coordinator-held session catalogue, visible to later statements
and later requests. For each `INSERT` / `CREATE MATERIALIZED VIEW` (and an
explicit `EXPLAIN`) the mode decides the action. Response (200):

```jsonc
{
  "ok": true,
  "mode": "explain",
  "applied": 2,
  "plans": [{ "kind": "insert", "explain": "Sink [..]\n  Project [..]\n    Scan [..]" }],
}
// mode=compile -> "specs": [ { "name": "sql_job", "spec_json": "<JobGraphSpec JSON string>" } ]
// mode=submit  -> "jobs":  [ { "name": "sql_job", "job_id": 7 } ]
```

A parse/bind/compile error returns 400 with `{ ok:false, error, position }`
(`position` is the 1-based byte offset, 0 if unknown). `ANALYZE` is rejected over
HTTP (it runs a local scan).

```
GET /api/v1/catalog      -> { tables: [ { name, kind, connector?, columns:[{name,type}], primary_key?:[] } ] }
GET /api/v1/connectors   -> { connectors: [ { name, source, sink, category,
                                              available,                       // built into this coordinator
                                              sink_delivery?, source_replayable, tls,
                                              variants: [ { name, source, sink, delivery,
                                                            transactional, commit_recoverable,
                                                            replayable, offset_model,
                                                            checkpoint_integrated, tls,
                                                            available_in_sql } ] } ] }
```

`/api/v1/catalog` is the session catalogue (drives the workbench browser +
autocomplete). `/api/v1/connectors` is the `WITH (connector='...')` vocabulary
(category + best-effort source/sink flags), and per entry what the running
coordinator declares: `available` (the connector is linked into this binary;
a submit using an unavailable one is refused), the capability records
(`variants`) grouped under the entry by the longest-prefix rule the engine's
delivery-guarantee gate uses (`kafka_2pc` under `kafka`, `s3_parquet_2pc`
under `s3_parquet`), and three roll-ups: `sink_delivery` is the strongest
delivery among its sink records (`at_most_once`, `at_least_once`,
`effectively_once_idempotent`, `exactly_once_atomic_publish`,
`exactly_once_two_phase_commit`, `no_durable_restart_guarantee`),
`source_replayable` whether a source record replays from a recorded position,
`tls` whether any record offers it. A connector-level delivery is what a
connector CAN provide; the job's end-to-end `delivery_guarantee` is what a
pipeline actually promises. The catalogue is in-memory unless the coordinator
is started with `--sql-catalog-dir <dir>`.

## Metrics dashboards

The Metrics dashboards page (`/dashboards`) groups the coordinator `/metrics` Prometheus
feed into per-domain panels (checkpoints, state & disaggregation, connectors,
SQL pipeline, resilience, cluster orchestration, process/system). The raw
searchable explorer stays at `/metrics`.

## Remaining notes

- **Metrics are Prometheus text**, not JSON, and point-in-time (no server-side
  history) — the console parses them and keeps a short rolling history in-page.
- **SSE has no backlog** on connect; the live feed starts from connection time.
  The coordinator publishes five named events: `coordinator.worker_registered`,
  `coordinator.worker_lost` (payload `{worker_id, cause}`, from the watchdog's
  loss handler), `coordinator.job_submitted`, `coordinator.job_lineage` (the
  job's lineage graph, shortly after the submit) and `coordinator.job_completed`.
