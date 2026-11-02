import { Link } from 'react-router-dom'
import { AlertTriangle, ExternalLink } from 'lucide-react'
import { useWorkers } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { WorkerStateBadge } from '@/components/StatusBadge'
import { pct } from '@/lib/format'
import { protocolVersions } from '@/lib/fleet'

export function Workers() {
  const workers = useWorkers()
  const versions = protocolVersions(workers.data ?? [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workers"
        description="The worker fleet registered with this Coordinator. Detail, logs and metrics are proxied per worker."
      />
      {versions.size > 1 && (
        <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/[0.06] px-4 py-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Workers registered with different cluster protocol versions:{' '}
            {[...versions.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([v, n]) => `v${v} ×${n}`)
              .join(', ')}
            . The coordinator accepted them all; the fleet is mid-upgrade or a worker runs an older
            binary.
          </div>
        </div>
      )}
      <Card>
        <CardContent className="px-0 py-0">
          {workers.isError ? (
            <ErrorState error={workers.error} />
          ) : workers.isLoading || !workers.data ? (
            <LoadingState />
          ) : workers.data.length === 0 ? (
            <EmptyState
              label="No Workers registered"
              hint="Start a worker with --coordinator-host/--coordinator-port pointing here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Data host</TableHead>
                  <TableHead>Slots</TableHead>
                  <TableHead>Utilisation</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workers.data.map((t) => (
                  <TableRow key={t.worker_id}>
                    <TableCell>
                      <Link
                        to={`/workers/${t.worker_id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {t.worker_id}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.data_host}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {t.slots_in_use}/{t.slot_capacity}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pct(t.slots_in_use, t.slot_capacity)}%
                    </TableCell>
                    <TableCell>
                      {t.http_port > 0 ? (
                        <span className="font-mono text-xs">:{t.http_port}</span>
                      ) : (
                        <Badge variant="muted">none</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.protocol_version ? (
                        <span className="font-mono text-xs">v{t.protocol_version}</span>
                      ) : (
                        <span
                          className="text-xs text-muted-foreground"
                          title="The worker, or this coordinator, predates the protocol version field."
                        >
                          -
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <WorkerStateBadge lost={t.lost} />
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/workers/${t.worker_id}`}
                        className="text-muted-foreground hover:text-primary"
                        aria-label={`Open worker ${t.worker_id}`}
                        title={`Open worker ${t.worker_id}`}
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
