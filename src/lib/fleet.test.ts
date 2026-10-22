import { describe, it, expect } from 'vitest'
import { protocolVersions } from './fleet'
import type { WorkerSummary } from './types'

function worker(id: string, protocol_version?: number): WorkerSummary {
  return {
    worker_id: id,
    data_host: 'h',
    slot_capacity: 4,
    slots_in_use: 0,
    lost: false,
    http_port: 0,
    protocol_version,
  }
}

describe('protocolVersions', () => {
  it('counts workers per non-zero version and ignores peers that predate the field', () => {
    const m = protocolVersions([
      worker('a', 3),
      worker('b', 3),
      worker('c', 2),
      worker('d', 0),
      worker('e'),
    ])
    expect([...m.entries()].sort()).toEqual([
      [2, 1],
      [3, 2],
    ])
  })

  it('is empty for an empty fleet', () => {
    expect(protocolVersions([]).size).toBe(0)
  })
})
