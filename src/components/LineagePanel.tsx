import { ArrowRight, Database } from 'lucide-react'
import { useJobLineage } from '@/hooks/useApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { LineageDataset, LineageVertex } from '@/lib/types'

// Data-lineage card: the external datasets a job reads and writes, from
// GET /api/v1/jobs/:id/lineage. Vertices are connectors, datasets are the
// topics/tables/paths they touch, edges are coarse source -> sink
// reachability. Renders nothing when the job has no connector datasets
// (e.g. a compiled .so job with in-process sources).
export function LineagePanel({ jobId }: { jobId: number }) {
  const lin = useJobLineage(jobId)
  const g = lin.data?.lineage
  if (!lin.data?.available || !g || (g.sources.length === 0 && g.sinks.length === 0)) {
    return null
  }

  const displayName = new Map<string, string>()
  for (const v of [...g.sources, ...g.sinks]) displayName.set(v.id, v.name || v.op_type)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          Data lineage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <VertexColumn label="Reads from" vertices={g.sources} />
          <VertexColumn label="Writes to" vertices={g.sinks} />
        </div>
        {g.edges.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            {g.edges.map((e) => (
              <span key={`${e.from}-${e.to}`} className="flex items-center gap-1 font-mono">
                {displayName.get(e.from) ?? e.from}
                <ArrowRight className="h-3 w-3" />
                {displayName.get(e.to) ?? e.to}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VertexColumn({ label, vertices }: { label: string; vertices: LineageVertex[] }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      {vertices.length === 0 ? (
        <div className="text-xs text-muted-foreground">none</div>
      ) : (
        vertices.map((v) => (
          <div key={v.id} className="rounded-md border border-border bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{v.name || v.op_type}</span>
              <Badge variant="muted">{v.op_type}</Badge>
              {v.boundedness && v.boundedness !== 'unknown' && (
                <Badge variant={v.boundedness === 'unbounded' ? 'info' : 'secondary'}>
                  {v.boundedness}
                </Badge>
              )}
            </div>
            <div className="mt-1 space-y-1">
              {v.datasets.map((d) => (
                <DatasetRow key={`${d.namespace}/${d.name}`} d={d} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DatasetRow({ d }: { d: LineageDataset }) {
  const facets = Object.entries(d.facets)
  const cols = d.column_lineage ?? []
  return (
    <div className="text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-muted-foreground">{d.namespace}</span>
        <span className="font-mono">{d.name}</span>
        {facets.map(([k, val]) => (
          <span key={k} className="text-muted-foreground" title={k}>
            {k}={val}
          </span>
        ))}
        {d.schema && d.schema.length > 0 && (
          <span className="text-muted-foreground">{d.schema.length} cols</span>
        )}
      </div>
      {cols.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            column lineage ({cols.length})
          </summary>
          <div className="mt-1 space-y-0.5 font-mono">
            {cols.map((c) => (
              <div key={c.output} className="flex flex-wrap items-center gap-1">
                <span>{c.output}</span>
                <span className="text-muted-foreground">
                  {c.inputs.length > 0
                    ? `← ${c.inputs.map((i) => `${i.name}.${i.field}`).join(', ')}`
                    : '(no traceable source)'}
                </span>
                {c.transformation && c.transformation !== 'IDENTITY' && (
                  <Badge variant="muted">{c.transformation.toLowerCase()}</Badge>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
