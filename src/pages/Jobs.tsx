import { Link } from 'react-router-dom'
import { UploadCloud } from 'lucide-react'
import { useJobs } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { GuaranteeBadge, JobStateBadge } from '@/components/StatusBadge'
import { JobLink } from '@/components/JobLink'
import { JobProgressBar } from '@/components/JobProgress'
import { deriveJobState } from '@/lib/types'

export function Jobs() {
  const jobs = useJobs()
  const sorted = (jobs.data ?? []).slice().sort((a, b) => b.id - a.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Jobs submitted to this Coordinator."
        actions={
          <Button asChild size="sm">
            <Link to="/submit">
              <UploadCloud className="h-4 w-4" />
              Submit job
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="px-0 py-0">
          {jobs.isError ? (
            <ErrorState error={jobs.error} />
          ) : jobs.isLoading || !jobs.data ? (
            <LoadingState />
          ) : sorted.length === 0 ? (
            <EmptyState
              label="No jobs submitted"
              hint="Upload a compiled job .so or post a JSON spec from Submit."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Guarantee</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Subtasks done</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((j) => {
                  return (
                    <TableRow key={j.id}>
                      <TableCell>
                        <JobLink id={j.id} name={j.name} />
                      </TableCell>
                      <TableCell>
                        <JobStateBadge state={deriveJobState(j)} />
                      </TableCell>
                      <TableCell>
                        <GuaranteeBadge
                          level={j.delivery_guarantee}
                          limitingFactor={j.guarantee_limiting_factor}
                        />
                      </TableCell>
                      <TableCell>
                        <JobProgressBar job={j} />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {j.from_history ? '-' : `${j.completed_count}/${j.expected_completion}`}
                      </TableCell>
                      <TableCell
                        className={
                          j.error_count > 0 ? 'font-medium text-danger' : 'text-muted-foreground'
                        }
                      >
                        {j.error_count}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
