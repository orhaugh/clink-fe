# Contributing to clink-fe

clink-fe is the operations console for [clink](https://github.com/orhaugh/clink)
clusters - a React + TypeScript + Vite single-page app that talks to a clink
coordinator's HTTP API. Small, focused changes are easiest to review and land.

## Setup

```bash
npm ci
npm run dev
```

The dev server proxies `/api` and `/metrics` to a running clink coordinator's
HTTP port. Point it at one with `VITE_CLINK_TARGET` (see `.env.example`):

```bash
clink_node --role=coordinator --port=7070 --http-port=8081
VITE_CLINK_TARGET=http://127.0.0.1:8081 npm run dev
```

## Quality gates

CI runs all of these on Node 20 and 22; run them locally before pushing:

```bash
npm run typecheck    # tsc, strict
npm run lint         # eslint (flat config)
npm run format:check # prettier
npm run test:run     # vitest
npm run build        # production build
```

`npm run format` fixes formatting in place. `npm run coverage` runs the suite
with coverage; the logic core (`src/lib`, the SSE hook) is hard-gated by
per-file thresholds in `vitest.config.ts` - keep it covered.

## Conventions

- Match the existing style; Prettier owns formatting, so don't hand-format.
- The API client and its types (`src/lib/api.ts`, `src/lib/types.ts`) mirror
  clink's HTTP API exactly - update both together when the API changes.
- Keep the console read-mostly and resilient to a partially-available cluster.
- Contributions are accepted under the repository's licence (Apache-2.0);
  opening a PR indicates agreement.
