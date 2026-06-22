import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Ban, GitCommitHorizontal } from 'lucide-react'
import { useJob, useCancelJob } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { JobStateBadge } from '@/components/StatusBadge'
import { toast } from '@/components/ui/sonner'
import { deriveJobState } from '@/lib/types'
import { pct } from '@/lib/format'

export function JobDetail() {
  const { id = '0' } = useParams()
  const jobId = Number(id)
  const job = useJob(jobId)
  const cancel = useCancelJob()

  const onCancel = async () => {
    const ack = await cancel.mutateAsync(jobId)
    if (ack.ok) toast.success(`Job #${jobId} cancelling`, { description: ack.message })
    else toast.error(`Cancel failed`, { description: ack.message })
  }

  if (job.isError) return <ErrorState error={job.error} />
  if (job.isLoading || !job.data) return <LoadingState />

  const j = job.data
  const state = deriveJobState(j)
  const progress = j.expected_completion > 0 ? pct(j.completed_count, j.expected_completion) : 0
  const canCancel = state === 'running'

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Link to="/jobs" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <span className="font-mono">Job #{j.id}</span>
            <JobStateBadge state={state} />
          </span>
        }
        actions={
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={!canCancel || cancel.isPending}>
                <Ban className="h-4 w-4" />
                Cancel job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel job #{j.id}?</DialogTitle>
                <DialogDescription>
                  This requests a graceful cancel. Subtasks drain via their cancellation paths; the job will not
                  restart. Savepoints and rescale are CLI-only and not available here.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" size="sm">
                    Keep running
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive" size="sm" onClick={onCancel}>
                    Cancel job
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Progress" value={`${progress}%`} sub={`${j.completed_count}/${j.expected_completion} subtasks`} tone="info" />
        <StatCard label="Subtasks" value={j.tasks.length} />
        <StatCard
          label="Latest checkpoint"
          value={j.latest_completed_checkpoint_id || '-'}
          sub={j.pending_checkpoint_ids.length > 0 ? `${j.pending_checkpoint_ids.length} pending` : 'none pending'}
          icon={GitCommitHorizontal}
        />
        <StatCard label="Errors" value={j.errors.length} tone={j.errors.length > 0 ? 'danger' : 'ok'} />
      </div>

      {j.errors.length > 0 && (
        <Card className="border-danger/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-4 w-4" />
              Failure messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {j.errors.map((e, i) => (
              <pre
                key={i}
                className="overflow-auto whitespace-pre-wrap rounded-md border border-danger/30 bg-danger/[0.05] p-3 font-mono text-xs text-danger/90"
              >
                {e}
              </pre>
            ))}
            <p className="text-xs text-muted-foreground">
              These are the operator-failure summaries the engine captures. Full per-subtask stack traces are not
              currently exposed over HTTP; check the owning TaskManager's logs for the surrounding context.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Subtask placement</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {j.tasks.length === 0 ? (
            <EmptyState label="No subtasks deployed" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Subtask</TableHead>
                  <TableHead>TaskManager</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {j.tasks.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{t.role}</TableCell>
                    <TableCell className="tabular-nums">{t.subtask_idx}</TableCell>
                    <TableCell>
                      {t.tm_id ? (
                        <Link to={`/task-managers/${t.tm_id}`} className="font-mono text-primary hover:underline">
                          {t.tm_id}
                        </Link>
                      ) : (
                        <Badge variant="muted">unassigned</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {j.pending_checkpoint_ids.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending checkpoints</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {j.pending_checkpoint_ids.map((c) => (
              <Badge key={c} variant="warn">
                #{c}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
