// Reading a text/event-stream body through fetch, for the one case EventSource
// cannot serve: a cluster that asks for a token, which EventSource has no way
// to send. The format is the WHATWG one clink's coordinator writes: lines of
// `field: value`, an event ending at a blank line, `event` naming its type
// ("message" when absent) and `data` lines joined with newlines; comments
// (lines starting with ':') and other fields are ignored.

export interface SseEvent {
  type: string
  data: string
}

// Splits a buffer into its complete events and the incomplete tail to keep
// for the next chunk. A trailing '\r' is held back, since its '\n' may arrive
// with the next chunk and the two are one line ending.
export function parseSse(buffer: string): { events: SseEvent[]; rest: string } {
  const held = buffer.endsWith('\r') ? '\r' : ''
  const text = (held ? buffer.slice(0, -1) : buffer).replace(/\r\n?/g, '\n')
  // split() always yields at least one piece: the last is the unfinished tail.
  const blocks = text.split('\n\n')
  const last = blocks.length - 1
  const rest = blocks[last] + held
  const events: SseEvent[] = []
  for (const block of blocks.slice(0, last)) {
    let type = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') type = value
      else if (field === 'data') data.push(value)
    }
    if (data.length > 0) events.push({ type, data: data.join('\n') })
  }
  return { events, rest }
}

// Feeds a response body to `onEvent` one event at a time; resolves when the
// server ends the stream.
export async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: SseEvent) => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })
    const { events, rest } = parseSse(buffer)
    buffer = rest
    events.forEach(onEvent)
  }
}
