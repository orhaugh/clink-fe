# clink HTTP API (frontend source of truth)

The console is built strictly against the endpoints below, as registered in
`tools/clink_node.cpp` and serialised by the writer helpers there plus the
snapshot structs in `include/clink/cluster/snapshots.hpp`. Types here mirror
`src/lib/types.ts`.

All routes are relative; the Coordinator is the single origin. The coordinator proxies
per-Worker routes under `/api/v1/workers/:id/*`, so the console only targets the
coordinator. The HTTP server sends **no CORS headers**, so the browser must reach it
same-origin (dev: the Vite proxy; prod: serve the SPA from the coordinator, or add CORS).

## Coordinator endpoints

| Method | Path                           | Response                                                                                                                              |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/health`               | `{ role, ok, uptime_s, bound_port }`                                                                                                  |
| GET    | `/api/v1/cluster`              | `ClusterSnapshot` (rollup + embedded `workers: WorkerSummary[]`)                                                                      |
| GET    | `/api/v1/config`               | `{ bind_host, advertise_host, heartbeat_timeout_ms, watchdog_interval_ms, submit_wait_for_slots_ms, restart_drain_timeout_ms }`       |
| GET    | `/api/v1/jobs`                 | `{ jobs: JobSummary[] }`                                                                                                              |
| GET    | `/api/v1/jobs/:id`             | `JobDetail` (404 `{error}` if unknown)                                                                                                |
| POST   | `/api/v1/jobs`                 | multipart: file part `job_so` (+ optional text `job_name`) → `{ ok, job_id, name }` or `{ error }`                                    |
| POST   | `/api/v1/jobs/spec`            | JSON body (JobGraphSpec), `?name=` → `{ ok, job_id, name }`                                                                           |
| POST   | `/api/v1/jobs/:id/cancel`      | `{ job_id, ok, message }` (404/409 on unknown/already-complete/in-progress)                                                           |
| POST   | `/api/v1/jobs/:id/savepoint`   | `?timeout_ms=` → `{ job_id, ok, checkpoint_id, checkpoint_dir, message }` (404/409 on failure)                                        |
| POST   | `/api/v1/jobs/:id/rescale`     | JSON body `{ "<role>": <parallelism>, ... }` (scale-up only) → `{ job_id, ok, message }`                                              |
| GET    | `/api/v1/workers`              | `{ workers: WorkerSummary[] }`                                                                                                        |
| GET    | `/api/v1/workers/:id/worker`   | `WorkerSnapshot` (proxied)                                                                                                            |
| GET    | `/api/v1/workers/:id/subtasks` | `{ subtasks: SubtaskRecord[] }` (proxied)                                                                                             |
| GET    | `/api/v1/workers/:id/config`   | `{ slot_count, heartbeat_interval_ms }` (proxied)                                                                                     |
| GET    | `/api/v1/workers/:id/metrics`  | Prometheus text (proxied)                                                                                                             |
| GET    | `/api/v1/workers/:id/logs`     | `{ logs: LogRecord[] }` (proxied)                                                                                                     |
| GET    | `/api/v1/logs`                 | `{ logs: LogRecord[] }`; `?level&limit&since_ms&source`                                                                               |
| GET    | `/api/v1/logs/components`      | `{ components: string[] }`                                                                                                            |
| GET    | `/metrics`                     | Prometheus exposition text (incl. system gauges, below)                                                                               |
| GET    | `/api/v1/events`               | SSE; event names `coordinator.worker_registered`, `coordinator.worker_lost`, `coordinator.job_submitted`, `coordinator.job_completed` |

Proxy routes return 404 if the worker is unknown/lost/has no HTTP listener, 502 if
unreachable.

## Worker endpoints (also served locally on each worker)

`/api/v1/health`, `/api/v1/worker` (`WorkerSnapshot`), `/api/v1/worker/subtasks`
(`{ subtasks }`), `/api/v1/config` (`{ slot_count, heartbeat_interval_ms }`),
`/metrics`, `/api/v1/logs`, `/api/v1/logs/components`, `/api/v1/events`.

## Shapes

```
WorkerSummary    { worker_id, data_host, slot_capacity, slots_in_use, lost, http_port }
ClusterSnapshot { bind_host, advertise_host, control_port, total_slot_capacity,
                  slots_in_use, jobs_total, jobs_running, jobs_completed,
                  workers: WorkerSummary[] }
JobSummary   { id, expected_completion, completed_count, completion_signalled,
               cancel_requested, error_count }
JobDetail    { id, expected_completion, completed_count, completion_signalled,
               cancel_requested, errors: string[],
               subtask_errors: { role, subtask_idx, worker_id, attempt, ts_ms, message }[],
               tasks: { role, subtask_idx, worker_id }[],
               latest_completed_checkpoint_id, pending_checkpoint_ids: number[] }
WorkerSnapshot   { worker_id, data_host, slot_capacity, slots_in_use, coordinator_host, coordinator_port,
               active_subtasks }
SubtaskRecord{ job_id, role, subtask_idx, status }   // status: "pending" | "ready"
LogRecord    { ts_ms, level, source, message }       // level: debug|info|warn|error
```

There is no single job-status enum on the wire; the console derives
running/completed/cancelled/failed from `error_count`/`errors`,
`cancel_requested`, `completion_signalled` (`deriveJobState`).

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
GET /api/v1/connectors   -> { connectors: [ { name, source, sink, category } ] }
```

`/api/v1/catalog` is the session catalogue (drives the workbench browser +
autocomplete); `/api/v1/connectors` is the `WITH (connector='...')` vocabulary
(category + best-effort source/sink flags; a connector only works at submit if
its impl is linked). The catalogue is in-memory unless the coordinator is started with
`--sql-catalog-dir <dir>`.

## Metrics dashboards

The Metrics dashboards page (`/dashboards`) groups the coordinator `/metrics` Prometheus
feed into per-domain panels (checkpoints, state & disaggregation, connectors,
SQL pipeline, resilience, cluster orchestration, process/system). The raw
searchable explorer stays at `/metrics`.

## Remaining notes

- **Metrics are Prometheus text**, not JSON, and point-in-time (no server-side
  history) — the console parses them and keeps a short rolling history in-page.
- **SSE has no backlog** on connect; the live feed starts from connection time.
