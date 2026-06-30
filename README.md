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
- **SQL workbench** - author clink SQL in a dialect-aware editor with
  catalogue-driven autocomplete, browse the session catalogue and the connector
  vocabulary, and Explain (see the logical plan), Compile (see the JobGraphSpec)
  or Submit (run it on the cluster). See [Sample SQL](#sample-sql-for-the-workbench).
- **Connectors** - the `WITH (connector='...')` vocabulary this build
  understands, grouped by category with source/sink capability.
- **Submit** - upload a compiled job `.so` (multipart) or post a JSON job spec.
- **Logs** - cluster-wide log explorer with level / source / since filters and
  follow mode, aggregating the JM and every TaskManager.
- **Metrics** - purpose-built dashboards over the JM Prometheus feed
  (checkpoints, state & disaggregation, connectors, SQL pipeline, resilience,
  orchestration, process / system), plus a searchable raw metric-family
  explorer. System cards also appear on each TaskManager's metrics tab.

## Sample SQL for the workbench

Paste these into the **SQL workbench** (`/sql`). Notes:

- **Explain** binds and plans the trailing `SELECT` / `INSERT` (no cluster
  resources needed); **Compile** returns the `JobGraphSpec`; **Submit** runs it.
- A bare `SELECT` works with **Explain** only - wrap it in `INSERT INTO <sink>`
  to Compile or Submit.
- DDL accumulates in the JobManager's **session catalogue**, so run the setup
  once; the queries then resolve against it. The setup uses `IF NOT EXISTS`, so
  it is safe to re-run. **Submit** additionally needs the connector endpoints to
  be reachable (a live Kafka here); Explain and Compile do not.
- Windowed aggregation needs an `event_time_column` on the source. Window sizes
  take an `INTERVAL` (or a plain millisecond integer, e.g. `TUMBLE(datetime, 10000)`).
- The full connector vocabulary is on the **Connectors** page; swap `connector`,
  `brokers`, `topic`, `path`, etc. for your environment.

### 1. Setup - define the source tables (run once)

```sql
CREATE TABLE IF NOT EXISTS bids (
  auction BIGINT, bidder BIGINT, price BIGINT, channel VARCHAR, datetime BIGINT
) WITH (connector='kafka', format='json', brokers='localhost:9092', topic='bids',
        event_time_column='datetime', watermark_lag_ms='4000');

CREATE TABLE IF NOT EXISTS auctions (
  id BIGINT, seller BIGINT, category BIGINT, datetime BIGINT, expires BIGINT
) WITH (connector='kafka', format='json', brokers='localhost:9092', topic='auctions',
        event_time_column='datetime', watermark_lag_ms='4000');
```

### 2. Filter + projection (Explain)

```sql
SELECT auction, bidder, price FROM bids WHERE price > 100;
```

### 3. Tumbling-window aggregation (Explain)

Bids per bidder in 10-second event-time windows:

```sql
SELECT bidder, COUNT(*) AS bid_count
FROM bids
GROUP BY TUMBLE(datetime, INTERVAL '10' SECOND), bidder;
```

### 4. Hopping + session windows (Explain)

```sql
-- 5s window sliding every 1s
SELECT channel, SUM(price) AS total
FROM bids
GROUP BY HOP(datetime, INTERVAL '5' SECOND, INTERVAL '1' SECOND), channel;

-- 30s inactivity-gap sessions
SELECT bidder, COUNT(*) AS n
FROM bids
GROUP BY SESSION(datetime, INTERVAL '30' SECOND), bidder;
```

### 5. Stream-stream join (Explain)

Join each bid to its auction; the join output flattens columns to
`<alias>_<column>` (so `bids AS B` gives `b_auction`, `b_price`, ...):

```sql
SELECT b_auction, a_seller, b_price
FROM bids AS B JOIN auctions AS A ON B.auction = A.id
WHERE b_datetime >= a_datetime AND b_datetime <= a_expires;
```

### 6. Logical view with a column-alias list (Explain)

A view is pure query rewrite (no storage); the alias list renames its outputs:

```sql
CREATE OR REPLACE VIEW pricey (auc, amount) AS
  SELECT auction, price FROM bids WHERE price > 1000;

SELECT auc, amount FROM pricey;
```

### 7. Submit a job end to end (Compile / Submit)

A complete `INSERT INTO <sink>` - works in all three modes:

```sql
CREATE TABLE IF NOT EXISTS bid_counts (bidder BIGINT, bid_count BIGINT)
  WITH (connector='kafka', format='json', brokers='localhost:9092', topic='bid-counts');

INSERT INTO bid_counts
SELECT bidder, COUNT(*) AS bid_count
FROM bids
GROUP BY TUMBLE(datetime, INTERVAL '10' SECOND), bidder;
```

### 8. Schema evolution (DDL, no job)

ALTER / SET / RENAME mutate the session catalogue in place; watch the catalogue
sidebar update:

```sql
ALTER TABLE bids ADD COLUMN url VARCHAR;
ALTER TABLE bids SET (group_id='workbench-demo');
ALTER TABLE bids RENAME COLUMN channel TO channel_name;
```

For a fully offline example (no Kafka needed, Submit included), swap the source
and sink for the `file` connector, e.g.
`WITH (connector='file', format='json', path='/tmp/in.ndjson')`.

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
