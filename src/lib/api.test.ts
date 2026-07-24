import { describe, it, expect, vi, afterEach } from 'vitest'
import { api, ApiError } from './api'

// Minimal Response-like stub; only the members the client touches.
function resp(init: {
  ok?: boolean
  status?: number
  statusText?: string
  json?: unknown
  text?: string
  jsonThrows?: boolean
}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => {
      if (init.jsonThrows) throw new SyntaxError('not json')
      return init.json
    },
    text: async () => init.text ?? '',
  } as unknown as Response
}

function mockFetch(handler: (url: string, req?: RequestInit) => Response) {
  const fn = vi.fn(async (url: string, req?: RequestInit) => handler(url, req))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getJson-backed reads', () => {
  it('returns parsed JSON for a plain object endpoint', async () => {
    mockFetch(() =>
      resp({ json: { role: 'coordinator', ok: true, uptime_s: 1, bound_port: 7070 } }),
    )
    await expect(api.health()).resolves.toMatchObject({ role: 'coordinator', ok: true })
  })

  it('sends the accept: application/json header', async () => {
    const fn = mockFetch(() => resp({ json: {} }))
    await api.cluster()
    expect(fn).toHaveBeenCalledWith(
      '/api/v1/cluster',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    )
  })

  it('unwraps the envelope field for list endpoints', async () => {
    mockFetch((url) => {
      if (url === '/api/v1/workers') return resp({ json: { workers: [{ worker_id: 'w-1' }] } })
      if (url === '/api/v1/jobs') return resp({ json: { jobs: [{ id: 1 }] } })
      if (url === '/api/v1/catalog') return resp({ json: { tables: [{ name: 't' }] } })
      if (url === '/api/v1/connectors') return resp({ json: { connectors: [{ name: 'kafka' }] } })
      throw new Error(`unexpected ${url}`)
    })
    await expect(api.workers()).resolves.toEqual([{ worker_id: 'w-1' }])
    await expect(api.jobs()).resolves.toEqual([{ id: 1 }])
    await expect(api.catalog()).resolves.toEqual([{ name: 't' }])
    await expect(api.connectors()).resolves.toEqual([{ name: 'kafka' }])
  })

  it('interpolates ids into proxied worker paths', async () => {
    const fn = mockFetch(() => resp({ json: { subtasks: [] } }))
    await api.worker('w-1')
    await api.workerSubtasks('w-2')
    expect(fn.mock.calls[0][0]).toBe('/api/v1/workers/w-1/worker')
    expect(fn.mock.calls[1][0]).toBe('/api/v1/workers/w-2/subtasks')
  })

  it('forwards the abort signal', async () => {
    const fn = mockFetch(() => resp({ json: {} }))
    const ctrl = new AbortController()
    await api.cluster(ctrl.signal)
    expect(fn.mock.calls[0][1]).toMatchObject({ signal: ctrl.signal })
  })
})

describe('log query building', () => {
  it('omits the query string when no filters are set', async () => {
    const fn = mockFetch(() => resp({ json: { logs: [] } }))
    await api.logs()
    expect(fn.mock.calls[0][0]).toBe('/api/v1/logs')
  })

  it('encodes level/limit/since_ms/source', async () => {
    const fn = mockFetch(() => resp({ json: { logs: [] } }))
    await api.logs({ level: 'error', limit: 50, since_ms: 123, source: 'coordinator.submit' })
    const url = fn.mock.calls[0][0]
    expect(url).toContain('/api/v1/logs?')
    expect(url).toContain('level=error')
    expect(url).toContain('limit=50')
    expect(url).toContain('since_ms=123')
    expect(url).toContain('source=coordinator.submit')
  })

  it('builds the proxied worker log path with query', async () => {
    const fn = mockFetch(() => resp({ json: { logs: [] } }))
    await api.workerLogs('w-1', { level: 'warn' })
    expect(fn.mock.calls[0][0]).toBe('/api/v1/workers/w-1/logs?level=warn')
  })
})

describe('error handling', () => {
  it('throws ApiError carrying the body.error message', async () => {
    mockFetch(() =>
      resp({ ok: false, status: 400, statusText: 'Bad Request', json: { error: 'bad table' } }),
    )
    await expect(api.cluster()).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'bad table',
    })
  })

  it('falls back to status + statusText when the JSON error body has no error field', async () => {
    mockFetch(() =>
      resp({ ok: false, status: 500, statusText: 'Internal Server Error', json: { detail: 'x' } }),
    )
    await expect(api.cluster()).rejects.toMatchObject({
      status: 500,
      message: '500 Internal Server Error',
    })
  })

  it('falls back to status + statusText when the error body is not JSON', async () => {
    mockFetch(() =>
      resp({ ok: false, status: 503, statusText: 'Service Unavailable', jsonThrows: true }),
    )
    await expect(api.cluster()).rejects.toMatchObject({
      status: 503,
      message: '503 Service Unavailable',
    })
  })

  it('getText throws ApiError on non-ok', async () => {
    mockFetch(() => resp({ ok: false, status: 500, statusText: 'err' }))
    await expect(api.metrics()).rejects.toBeInstanceOf(ApiError)
  })

  it('getText returns the body text on success', async () => {
    mockFetch(() => resp({ text: 'clink_up 1\n' }))
    await expect(api.metrics()).resolves.toBe('clink_up 1\n')
  })
})

describe('mutations', () => {
  it('cancelJob POSTs to the cancel path', async () => {
    const fn = mockFetch(() => resp({ json: { job_id: 1, ok: true, message: 'cancelling' } }))
    await expect(api.cancelJob(1)).resolves.toMatchObject({ ok: true })
    expect(fn).toHaveBeenCalledWith('/api/v1/jobs/1/cancel', { method: 'POST' })
  })

  it('savepointJob adds the timeout query only when given', async () => {
    const fn = mockFetch(() => resp({ json: {} }))
    await api.savepointJob(2)
    await api.savepointJob(2, 5000)
    expect(fn.mock.calls[0][0]).toBe('/api/v1/jobs/2/savepoint')
    expect(fn.mock.calls[1][0]).toBe('/api/v1/jobs/2/savepoint?timeout_ms=5000')
  })

  it('rescaleJob sends the role->parallelism map as a JSON body', async () => {
    const fn = mockFetch(() => resp({ json: {} }))
    await api.rescaleJob(3, { map: 4 })
    const req = fn.mock.calls[0][1]!
    expect(req.method).toBe('POST')
    expect(JSON.parse(req.body as string)).toEqual({ map: 4 })
  })

  it('submitSpec encodes the name into the query', async () => {
    const fn = mockFetch(() => resp({ json: {} }))
    await api.submitSpec('{}', 'my job')
    expect(fn.mock.calls[0][0]).toBe('/api/v1/jobs/spec?name=my%20job')
  })
})

describe('remaining GET routes', () => {
  it('hit the correct paths and unwrap where applicable', async () => {
    const fn = mockFetch((url) => {
      const table: Record<string, Response> = {
        '/api/v1/config': resp({ json: { bind_host: 'h' } }),
        '/api/v1/jobs/7': resp({ json: { id: 7 } }),
        '/api/v1/jobs/7/graph': resp({ json: { job_id: 7 } }),
        '/api/v1/jobs/7/operators': resp({ json: { job_id: 7, operators: [] } }),
        '/api/v1/jobs/7/lineage': resp({
          json: { job_id: 7, available: true, lineage: { sources: [], sinks: [], edges: [] } },
        }),
        '/api/v1/workers/w/config': resp({ json: { slot_count: 4 } }),
        '/api/v1/workers/w/metrics': resp({ text: 'clink_up 1' }),
        '/api/v1/logs/components': resp({ json: { components: ['coordinator'] } }),
      }
      const r = table[url]
      if (!r) throw new Error(`unexpected ${url}`)
      return r
    })
    await expect(api.coordinatorConfig()).resolves.toMatchObject({ bind_host: 'h' })
    await expect(api.job(7)).resolves.toMatchObject({ id: 7 })
    await expect(api.jobGraph(7)).resolves.toMatchObject({ job_id: 7 })
    await expect(api.jobOperators(7)).resolves.toMatchObject({ operators: [] })
    await expect(api.jobLineage(7)).resolves.toMatchObject({ available: true })
    await expect(api.workerConfig('w')).resolves.toMatchObject({ slot_count: 4 })
    await expect(api.workerMetrics('w')).resolves.toBe('clink_up 1')
    await expect(api.logComponents()).resolves.toEqual(['coordinator'])
    expect(fn).toHaveBeenCalledTimes(8)
  })

  it('submitJobSo posts multipart form data with the job name', async () => {
    const fn = mockFetch(() => resp({ json: { ok: true, job_id: 1 } }))
    await api.submitJobSo(new File(['x'], 'job.so'), 'demo')
    const [url, req] = fn.mock.calls[0]
    expect(url).toBe('/api/v1/jobs')
    expect(req!.method).toBe('POST')
    expect(req!.body).toBeInstanceOf(FormData)
    expect((req!.body as FormData).get('job_name')).toBe('demo')
  })

  it('submitJobSo omits job_name when none is given', async () => {
    const fn = mockFetch(() => resp({ json: { ok: true, job_id: 2 } }))
    await api.submitJobSo(new File(['x'], 'job.so'))
    const [, req] = fn.mock.calls[0]
    expect((req!.body as FormData).get('job_name')).toBeNull()
  })

  it('submitSpec posts to the bare spec path when no name is given', async () => {
    const fn = mockFetch(() => resp({ json: { ok: true, job_id: 3 } }))
    await api.submitSpec('{}')
    expect(fn.mock.calls[0][0]).toBe('/api/v1/jobs/spec')
  })
})

describe('runSql (never throws)', () => {
  it('passes mode and options through the query string', async () => {
    const fn = mockFetch(() => resp({ json: { ok: true, mode: 'submit' } }))
    await api.runSql('SELECT 1', 'submit', { parallelism: 4, name: 'q' })
    const url = fn.mock.calls[0][0]
    expect(url).toContain('mode=submit')
    expect(url).toContain('parallelism=4')
    expect(url).toContain('name=q')
  })

  it('returns the parsed error body on a 400 rather than throwing', async () => {
    mockFetch(() =>
      resp({ ok: false, status: 400, json: { ok: false, error: 'syntax', position: 8 } }),
    )
    await expect(api.runSql('SELEC 1', 'compile')).resolves.toEqual({
      ok: false,
      error: 'syntax',
      position: 8,
    })
  })

  it('returns {ok:false} with the message when fetch itself rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    await expect(api.runSql('SELECT 1', 'explain')).resolves.toEqual({
      ok: false,
      error: 'network down',
    })
  })

  it('reports "network error" when fetch rejects with a non-Error value', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw 'connection reset'
      }),
    )
    await expect(api.runSql('SELECT 1', 'explain')).resolves.toEqual({
      ok: false,
      error: 'network error',
    })
  })

  it('returns {ok:false} with status text when the response is not JSON', async () => {
    mockFetch(() => resp({ status: 502, statusText: 'Bad Gateway', jsonThrows: true }))
    await expect(api.runSql('SELECT 1', 'explain')).resolves.toEqual({
      ok: false,
      error: '502 Bad Gateway',
    })
  })
})
