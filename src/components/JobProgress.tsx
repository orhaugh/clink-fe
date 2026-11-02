import { useJobLineage } from '@/hooks/useApi'
import { RECORD_HINT, STREAMING_HINT, jobProgress, type ProgressInput } from '@/lib/progress'

type JobRow = ProgressInput & { id: number }

// The jobs list's progress cell: the share of finished subtasks as a bar, or
// "streaming" for a running job that reads an unbounded source. The lineage
// it is judged from is fetched once per job and cached; a job known only from
// its history record has none, and shows a dash.
export function JobProgressBar({ job }: { job: JobRow }) {
  const view = jobProgress(job, useJobLineage(job.id, !job.from_history).data)
  if (view.kind === 'record') {
    return (
      <span className="text-xs text-muted-foreground" title={RECORD_HINT}>
        -
      </span>
    )
  }
  if (view.kind === 'streaming') {
    return (
      <span className="text-xs text-muted-foreground" title={STREAMING_HINT}>
        streaming
      </span>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${view.pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{view.pct}%</span>
    </div>
  )
}

// The same judgement as text, for the overview's recent jobs.
export function JobProgressText({ job }: { job: JobRow }) {
  const view = jobProgress(job, useJobLineage(job.id, !job.from_history).data)
  if (view.kind === 'record') return <span title={RECORD_HINT}>-</span>
  if (view.kind === 'streaming') return <span title={STREAMING_HINT}>streaming</span>
  return (
    <>
      {view.done}/{view.total}
    </>
  )
}
