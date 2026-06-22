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
| GET | `/api/v1/tms` | `{ task_managers: TmSummary[] }` |
| GET | `/api/v1/tms/:id/tm` | `TmSnapshot` (proxied) |
| GET | `/api/v1/tms/:id/subtasks` | `{ subtasks: SubtaskRecord[] }` (proxied) |
| GET | `/api/v1/tms/:id/config` | `{ slot_count, heartbeat_interval_ms }` (proxied) |
| GET | `/api/v1/tms/:id/metrics` | Prometheus text (proxied) |
| GET | `/api/v1/tms/:id/logs` | `{ logs: LogRecord[] }` (proxied) |
| GET | `/api/v1/logs` | `{ logs: LogRecord[] }`; `?level&limit&since_ms&source` |
| GET | `/api/v1/logs/components` | `{ components: string[] }` |
| GET | `/metrics` | Prometheus exposition text |
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

## Known gaps (features bounded by the backend)

- **Stack traces.** Only job-level `errors[]` strings are exposed (the
  operator-failure summaries the engine captures). There is no per-subtask
  exception/stack-trace payload over HTTP. The Job detail page shows `errors[]`
  and points at the owning TM's logs; richer traces would need a new endpoint.
- **Savepoint / rescale.** CLI-only (`clink_savepoint`, `clink_rescale_job`);
  they drive the control-plane protocol, not HTTP. The console does not invent
  them. Only **cancel** is available over HTTP.
- **Metrics are Prometheus text**, not JSON, and point-in-time (no server-side
  history) — the console parses them and keeps a short rolling history in-page.
- **No CORS** — same-origin only (dev proxy / prod served from the JM).
- **SSE has no backlog** on connect; the live feed starts from connection time.
