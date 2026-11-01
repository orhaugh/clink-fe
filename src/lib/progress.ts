// How far along a job is, for the jobs list, the overview and the job page.
//
// The coordinator counts finished subtasks against the job's total. That
// share means something for a job whose input ends: it climbs to 100% as the
// subtasks finish. A job reading an unbounded source never finishes a
// subtask while it runs, so the same share sits at 0% for as long as the job
// is healthy. Such a job is reported as streaming instead, from its lineage,
// which classifies each source as bounded, unbounded or unknown.
import { pct } from './format'
import { deriveJobState, type JobLineage, type JobSummary } from './types'

// The fields a job summary and a job detail share that progress reads.
export type ProgressInput = Pick<
  JobSummary,
  'completed_count' | 'expected_completion' | 'cancel_requested' | 'completion_signalled' | 'status'
> & { error_count?: number; errors?: string[] }

// True when the job's lineage names a source the engine classifies as
// unbounded. A job whose lineage is not in yet, or whose sources are all
// bounded or unknown, is not assumed to run forever.
export function hasUnboundedSource(lineage: JobLineage | undefined): boolean {
  if (!lineage?.available) return false
  return lineage.lineage.sources.some((s) => s.boundedness === 'unbounded')
}

// Shown on hover wherever a job reads as streaming.
export const STREAMING_HINT =
  'Reads an unbounded source, so it runs until it is stopped and finishes no subtask while it runs.'

export type ProgressView =
  { kind: 'streaming'; total: number } | { kind: 'share'; pct: number; done: number; total: number }

// A running job with an unbounded source is streaming; every other job, and
// any job once it has stopped, shows its share of finished subtasks.
export function jobProgress(j: ProgressInput, lineage: JobLineage | undefined): ProgressView {
  const done = j.completed_count
  const total = j.expected_completion
  if (deriveJobState(j) === 'running' && hasUnboundedSource(lineage)) {
    return { kind: 'streaming', total }
  }
  return { kind: 'share', pct: total > 0 ? pct(done, total) : 0, done, total }
}
