# clink console (clink-fe)

A modern operations console for clink clusters: JobManager and TaskManager
visibility, job submission, cluster-wide logs, live metrics, and job
failure/error inspection.

Built with React + TypeScript + Vite + Tailwind + shadcn-style components, in a
dark ops theme. It talks only to clink's existing HTTP API; there is no separate
backend.

## Running

clink's HTTP server sends no CORS headers, so the browser cannot call it
cross-origin. In dev the Vite server proxies `/api` and `/metrics` to a running
JobManager.

1. Start a JobManager with a fixed HTTP port:

   ```bash
   clink_node --role=jm --port=7070 --http-port=8081
   # and one or more TaskManagers, each with their own HTTP port:
   clink_node --role=tm --id=tm-1 --jm-host=127.0.0.1 --jm-port=7070 --http-port=8091
   ```

2. Point the console at it and run:

   ```bash
   cp .env.example .env        # edit VITE_CLINK_TARGET if not :8081
   npm install
   npm run dev                 # http://localhost:5181
   ```

The JobManager is the single entry point: it proxies per-TaskManager routes
(`/api/v1/tms/:id/*`), so the console only needs the JM target. TaskManagers must
be started with `--http-port` for their detail/logs/metrics to be reachable
through the JM proxy.

Alternatively, skip the dev proxy and point the console straight at the JM by
enabling CORS on the node:

```bash
clink_node --role=jm --port=7070 --http-port=8081 --http-cors-origin='*'
```

## What it shows

- **Overview** - cluster rollup (slots, jobs), TaskManager fleet, recent jobs,
  and a live event feed (SSE).
- **TaskManagers** - the fleet, plus per-TM detail: running subtasks, config,
  parsed metrics, and logs.
- **Jobs** - submitted jobs, plus per-job detail: subtask placement, checkpoint
  progress, structured per-subtask failures with stack traces, and savepoint /
  rescale / cancel actions.
- **Submit** - upload a compiled job `.so` (multipart) or post a JSON job spec.
- **Logs** - cluster-wide log explorer with level / source / since filters and
  follow mode, aggregating the JM and every TaskManager.
- **Metrics** - parsed Prometheus exposition: per-node system resources (memory,
  CPU, disk, file descriptors, threads), checkpoint stats, rolling session
  charts, and a searchable metric-family table. System cards also appear on each
  TaskManager's metrics tab.

## API source of truth

See `docs/clink-api.md` for the exact endpoint and JSON-shape reference the
typed client in `src/lib/` is built against, including the known gaps (no
per-subtask stack traces, savepoint/rescale are CLI-only, metrics are Prometheus
text).

## Build

```bash
npm run typecheck
npm run build
```
