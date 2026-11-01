import { describe, it, expect } from 'vitest'
import { hasUnboundedSource, jobProgress } from './progress'
import type { JobLineage, JobSummary } from './types'

const job = (over: Partial<JobSummary> = {}): JobSummary => ({
  id: 4,
  expected_completion: 24,
  completed_count: 0,
  completion_signalled: false,
  cancel_requested: false,
  error_count: 0,
  status: 'RUNNING',
  ...over,
})

const lineage = (...boundedness: string[]): JobLineage => ({
  job_id: 4,
  available: true,
  lineage: {
    sources: boundedness.map((b, i) => ({
      id: `src${i}`,
      uid: '',
      name: 'kafka_source_string',
      op_type: 'kafka_source_string',
      boundedness: b,
      datasets: [],
    })),
    sinks: [],
    edges: [],
  },
})

describe('hasUnboundedSource', () => {
  it('is true when any source is unbounded', () => {
    expect(hasUnboundedSource(lineage('bounded', 'unbounded'))).toBe(true)
  })

  it('is false for bounded or unknown sources, and for lineage not in yet', () => {
    expect(hasUnboundedSource(lineage('bounded', 'unknown'))).toBe(false)
    expect(hasUnboundedSource(undefined)).toBe(false)
    expect(hasUnboundedSource({ ...lineage('unbounded'), available: false })).toBe(false)
  })
})

describe('jobProgress', () => {
  it('reports a running job with an unbounded source as streaming', () => {
    expect(jobProgress(job(), lineage('unbounded'))).toEqual({ kind: 'streaming', total: 24 })
  })

  it('reports the share of finished subtasks for a bounded job', () => {
    expect(jobProgress(job({ completed_count: 6 }), lineage('bounded'))).toEqual({
      kind: 'share',
      pct: 25,
      done: 6,
      total: 24,
    })
  })

  it('reports the share once a streaming job has stopped', () => {
    const stopped = job({ status: 'COMPLETED_OK', completed_count: 3, expected_completion: 3 })
    expect(jobProgress(stopped, lineage('unbounded'))).toEqual({
      kind: 'share',
      pct: 100,
      done: 3,
      total: 3,
    })
  })

  it('reports 0% for a job with no subtasks expected', () => {
    expect(jobProgress(job({ expected_completion: 0 }), undefined)).toMatchObject({
      kind: 'share',
      pct: 0,
    })
  })
})
