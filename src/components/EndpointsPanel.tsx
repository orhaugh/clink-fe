import { ArrowRightToLine, Database } from 'lucide-react'
import { useConnectors, useJobGraph, useJobLineage, useJobOperators } from '@/hooks/useApi'
import { useOperatorRates } from '@/hooks/useOperatorRates'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeliveryBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/States'
import { datasetLabel, endpointRows, type EndpointRow } from '@/lib/endpoints'
import { fmtCount, fmtRate, fmtTime } from '@/lib/format'

// The job's sources and sinks in one table: the connector each one was built
// on and the delivery that connector declares, the external dataset it reads
// or writes, its parallelism, and live throughput. The job-level guarantee is
// on the recovery card; this is the per-endpoint view behind it.
export function EndpointsPanel({ jobId }: { jobId: number }) {
  const graph = useJobGraph(jobId)
  const ops = useJobOperators(jobId)
  const lineage = useJobLineage(jobId)
  const connectors = useConnectors()
  const rates = useOperatorRates(ops.data)

  const rows = endpointRows(graph.data, ops.data, lineage.data, connectors.data)
  if (!graph.data?.available) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Sources &amp; sinks
          <span className="text-xs font-normal text-muted-foreground">
            {rows.filter((r) => r.kind === 'source').length} source
            {rows.filter((r) => r.kind === 'source').length === 1 ? '' : 's'},{' '}
            {rows.filter((r) => r.kind === 'sink').length} sink
            {rows.filter((r) => r.kind === 'sink').length === 1 ? '' : 's'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <EmptyState label="No source or sink operators in this topology" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Role</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Connector</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead className="text-right">Par.</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead>Watermark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <EndpointTableRow key={r.id} row={r} rate={rates[r.id]} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function EndpointTableRow({ row, rate }: { row: EndpointRow; rate?: { in: number; out: number } }) {
  const isSource = row.kind === 'source'
  const total = row.stats?.metrics_available
    ? isSource
      ? row.stats.records_out
      : row.stats.records_in
    : undefined
  const perSec = rate ? (isSource ? rate.out : rate.in) : undefined
  const variant = row.match?.variant
  return (
    <TableRow>
      <TableCell>
        {isSource ? (
          <Badge variant="info">
            <Database className="mr-1 h-3 w-3" /> source
          </Badge>
        ) : (
          <Badge variant="ok">
            <ArrowRightToLine className="mr-1 h-3 w-3" /> sink
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <div className="font-mono text-xs">{row.name}</div>
        {row.name !== row.opType && (
          <div className="font-mono text-[10px] text-muted-foreground">{row.opType}</div>
        )}
      </TableCell>
      <TableCell>
        {row.match ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs">{variant?.name ?? row.match.connector.name}</span>
            {variant && !isSource && <DeliveryBadge level={variant.delivery} />}
            {variant && isSource && (
              <Badge
                variant={variant.replayable ? 'ok' : 'warn'}
                title={`offset model: ${variant.offset_model}`}
              >
                {variant.replayable ? 'replays' : 'no replay'}
              </Badge>
            )}
            {row.boundedness && row.boundedness !== 'unknown' && (
              <Badge variant="muted">{row.boundedness}</Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell className="max-w-[18rem]">
        {row.datasets.length === 0 ? (
          <span className="text-xs text-muted-foreground">-</span>
        ) : (
          <div className="space-y-0.5">
            {row.datasets.map((d) => (
              <div
                key={datasetLabel(d)}
                className="truncate font-mono text-xs"
                title={datasetLabel(d)}
              >
                {d.namespace && <span className="text-muted-foreground">{d.namespace} </span>}
                {d.name}
              </div>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">×{row.parallelism}</TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {total != null ? fmtCount(total) : <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums">
        {perSec != null ? `${fmtRate(perSec)}/s` : <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell className="font-mono text-xs">
        <Watermark ms={row.watermarkMs} via={row.watermarkVia} />
      </TableCell>
    </TableRow>
  )
}

// A source that has emitted the maximum watermark (int64 max, which JSON
// cannot carry exactly) has declared its event time complete; anything past
// the year 2100 is shown as that rather than as a nonsense date.
const MAX_SANE_WATERMARK_MS = 4_102_444_800_000

function Watermark({ ms, via }: { ms?: number; via?: string }) {
  if (ms == null) {
    return <span className="text-muted-foreground">-</span>
  }
  // Taken from the operator downstream that assigns the source's watermarks.
  const title = via ? `from ` : undefined
  if (!(ms > 0) || ms >= MAX_SANE_WATERMARK_MS) {
    return (
      <span className="text-muted-foreground" title={via ? `: ` : String(ms)}>
        max
      </span>
    )
  }
  return <span title={title}>{fmtTime(ms)}</span>
}
