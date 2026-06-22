# clink HTTP API (frontend source of truth)

The console is built strictly against the endpoints below, as registered in
`tools/clink_node.cpp` and serialised by the writer helpers there plus the
snapshot structs in `include/clink/cluster/snapshots.hpp`. Types here mirror
`src/lib/types.ts`.

All routes are relative; the JobManager is the single origin. The JM proxies
per-TaskManager routes under `/api/v1/tms/:id/*`, so the console only targets the
JM. The HTTP server sends **no CORS headers**, so the browser must reach it
same-origin (dev: the Vite proxy; prod: serve the SPA from the JM, or add CORS).

## JobManager endpoints

| Method | Path | Response |
|---|---|---|
| GET | `/api/v1/health` | `{ role, ok, uptime_s, bound_port }` |
| GET | `/api/v1/cluster` | `ClusterSnapshot` (rollup + embedded `task_managers: TmSummary[]`) |
| GET | `/api/v1/config` | `{ bind_host, advertise_host, heartbeat_timeout_ms, watchdog_interval_ms, submit_wait_for_slots_ms, restart_drain_timeout_ms }` |
| GET | `/api/v1/jobs` | `{ jobs: JobSummary[] }` |
| GET | `/api/v1/jobs/:id` | `JobDetail` (404 `{error}` if unknown) |
| POST | `/api/v1/jobs` | multipart: file part `job_so` (+ optional text `job_name`) → `{ ok, job_id, name }` or `{ error }` |
| POST | `/api/v1/jobs/spec` | JSON body (JobGraphSpec), `?name=` → `{ ok, job_id, name }` |
| POST | `/api/v1/jobs/:id/cancel` | `{ job_id, ok, message }` (404/409 on unknown/already-complete/in-progress) |
| POST | `/api/v1/jobs/:id/savepoint` | `?timeout_ms=` → `{ job_id, ok, checkpoint_id, checkpoint_dir, message }` (404/409 on failure) |
| POST | `/api/v1/jobs/:id/rescale` | JSON body `{ "<role>": <parallelism>, ... }` (scale-up only) → `{ job_id, ok, message }` |
| GET | `/api/v1/tms` | `{ task_managers: TmSummary[] }` |
| GET | `/api/v1/tms/:id/tm` | `TmSnapshot` (proxied) |
| GET | `/api/v1/tms/:id/subtasks` | `{ subtasks: SubtaskRecord[] }` (proxied) |
| GET | `/api/v1/tms/:id/config` | `{ slot_count, heartbeat_interval_ms }` (proxied) |
| GET | `/api/v1/tms/:id/metrics` | Prometheus text (proxied) |
| GET | `/api/v1/tms/:id/logs` | `{ logs: LogRecord[] }` (proxied) |
| GET | `/api/v1/logs` | `{ logs: LogRecord[] }`; `?level&limit&since_ms&source` |
| GET | `/api/v1/logs/components` | `{ components: string[] }` |
| GET | `/metrics` | Prometheus exposition text (incl. system gauges, below) |
| GET | `/api/v1/events` | SSE; event names `jm.tm_registered`, `jm.tm_lost`, `jm.job_submitted`, `jm.job_completed` |

Proxy routes return 404 if the TM is unknown/lost/has no HTTP listener, 502 if
unreachable.

## TaskManager endpoints (also served locally on each TM)

`/api/v1/health`, `/api/v1/tm` (`TmSnapshot`), `/api/v1/tm/subtasks`
(`{ subtasks }`), `/api/v1/config` (`{ slot_count, heartbeat_interval_ms }`),
`/metrics`, `/api/v1/logs`, `/api/v1/logs/components`, `/api/v1/events`.

## Shapes

```
TmSummary    { tm_id, data_host, slot_capacity, slots_in_use, lost, http_port }
ClusterSnapshot { bind_host, advertise_host, control_port, total_slot_capacity,
                  slots_in_use, jobs_total, jobs_running, jobs_completed,
                  task_managers: TmSummary[] }
JobSummary   { id, expected_completion, completed_count, completion_signalled,
               cancel_requested, error_count }
JobDetail    { id, expected_completion, completed_count, completion_signalled,
               cancel_requested, errors: string[],
               subtask_errors: { role, subtask_idx, tm_id, attempt, ts_ms, message }[],
               tasks: { role, subtask_idx, tm_id }[],
               latest_completed_checkpoint_id, pending_checkpoint_ids: number[] }
TmSnapshot   { tm_id, data_host, slot_capacity, slots_in_use, jm_host, jm_port,
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
  `subtask_errors[]` (role, subtask_idx, tm_id, attempt, ts_ms, message)
  alongside the flat `errors[]`. Where the node toolchain has C++23
  `std::stacktrace` (GCC builds), the executor appends a capture-site trace to
  the message. Honest limitation: the trace is taken in the runner thread
  post-unwind, so it shows the runner to operator call chain, not the exact
  throw frame. On toolchains without `<stacktrace>` (macOS/libc++) the message
  carries the exception text only.
- **Savepoint / rescale over HTTP.** `POST /api/v1/jobs/:id/savepoint` and
  `/rescale` wrap the same JM operations as `clink_savepoint` /
  `clink_rescale_job`. Both are synchronous; rescale is scale-up only.
- **CORS.** Start the node with `--http-cors-origin=<origin>` (e.g. `*`) to send
  `Access-Control-Allow-*` and answer OPTIONS preflight, so a standalone console
  can call the API cross-origin without the dev proxy.

## System metrics

Both JM and TM `/metrics` carry per-process resource gauges, sampled on each
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
and, when the node is started with `--metrics-disk-path=<path>` (the JM defaults
this to `--ha-dir`), `checkpoint` for the checkpoint/state mount. Volumes on the
same filesystem are de-duplicated, so a single-disk node reports one `workdir`
volume. The console renders one disk card per volume.

The console renders these as a System card row on the Metrics page (JM) and each
TaskManager's metrics tab, plus a rolling CPU/memory session chart.

## Remaining notes

- **Metrics are Prometheus text**, not JSON, and point-in-time (no server-side
  history) — the console parses them and keeps a short rolling history in-page.
- **SSE has no backlog** on connect; the live feed starts from connection time.
