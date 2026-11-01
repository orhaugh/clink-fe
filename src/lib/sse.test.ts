import { describe, expect, it } from 'vitest'
import { parseSse, readEventStream, type SseEvent } from './sse'

const stream = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk))
      c.close()
    },
  })

describe('parseSse', () => {
  it('reads named events and keeps an unfinished one for the next chunk', () => {
    const { events, rest } = parseSse(
      'event: coordinator.job_submitted\ndata: {"job_id":1}\n\nevent: coordinator.job_completed\ndata: {"jo',
    )
    expect(events).toEqual([{ type: 'coordinator.job_submitted', data: '{"job_id":1}' }])
    expect(rest).toBe('event: coordinator.job_completed\ndata: {"jo')
  })

  it('defaults the type, joins data lines and skips comments and other fields', () => {
    const { events } = parseSse(': keep-alive\n\nid: 7\nretry: 1000\ndata:a\ndata: b\n\n')
    expect(events).toEqual([{ type: 'message', data: 'a\nb' }])
  })

  it('treats CRLF and CR as line endings, holding a CR that may precede the next LF', () => {
    expect(parseSse('data: x\r\n\r\n').events).toEqual([{ type: 'message', data: 'x' }])
    const first = parseSse('data: y\r\n\r')
    expect(first.events).toEqual([])
    expect(parseSse(first.rest + '\n').events).toEqual([{ type: 'message', data: 'y' }])
  })

  it('reads a field line with no colon as that field, empty', () => {
    expect(parseSse('data\n\n').events).toEqual([{ type: 'message', data: '' }])
  })

  it('dispatches nothing for an event without data', () => {
    expect(parseSse('event: ping\n\n').events).toEqual([])
  })
})

describe('readEventStream', () => {
  it('delivers events however the body is chunked, then resolves when it ends', async () => {
    const seen: SseEvent[] = []
    await readEventStream(stream('event: a\nda', 'ta: 1\n\nevent: b\n', 'data: 2\n\n'), (e) =>
      seen.push(e),
    )
    expect(seen).toEqual([
      { type: 'a', data: '1' },
      { type: 'b', data: '2' },
    ])
  })
})
