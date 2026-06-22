import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useTms } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { TmStateBadge } from '@/components/StatusBadge'
import { pct } from '@/lib/format'

export function TaskManagers() {
  const tms = useTms()

  return (
    <div className="space-y-6">
      <PageHeader
        title="TaskManagers"
        description="The worker fleet registered with this JobManager. Detail, logs and metrics are proxied per TM."
      />
      <Card>
        <CardContent className="px-0 py-0">
          {tms.isError ? (
            <ErrorState error={tms.error} />
          ) : tms.isLoading || !tms.data ? (
            <LoadingState />
          ) : tms.data.length === 0 ? (
            <EmptyState label="No TaskManagers registered" hint="Start a TM with --jm-host/--jm-port pointing here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TaskManager</TableHead>
                  <TableHead>Data host</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead>Utilisation</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tms.data.map((t) => (
                  <TableRow key={t.tm_id}>
                    <TableCell>
                      <Link to={`/task-managers/${t.tm_id}`} className="font-mono text-primary hover:underline">
                        {t.tm_id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.data_host}</TableCell>
                    <TableCell className="tabular-nums">
                      {t.slots_in_use}/{t.slot_capacity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pct(t.slots_in_use, t.slot_capacity)}%</TableCell>
                    <TableCell>
                      {t.http_port > 0 ? (
                        <span className="font-mono text-xs">:{t.http_port}</span>
                      ) : (
                        <Badge variant="muted">none</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TmStateBadge lost={t.lost} />
                    </TableCell>
                    <TableCell>
                      <Link to={`/task-managers/${t.tm_id}`} className="text-muted-foreground hover:text-primary">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
