import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Pause, Play, Search } from 'lucide-react'
import { api, type LogQuery } from '@/lib/api'
import { qk, useCluster, useLogComponents } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { LogViewer } from '@/components/LogViewer'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/States'
import type { LogRecord } from '@/lib/types'

const LEVELS = ['debug', 'info', 'warn', 'error'] as const
const LIMIT = 500

type NodeId = string // 'jm' | 'all' | tm_id

export function Logs() {
  const cluster = useCluster()
  const components = useLogComponents()

  const [node, setNode] = useState<NodeId>('all')
  const [level, setLevel] = useState<string>('debug')
  const [source, setSource] = useState<string>('')
  const [follow, setFollow] = useState(true)

  const httpTms = (cluster.data?.task_managers ?? []).filter((t) => t.http_port > 0 && !t.lost)

  // Which nodes to fetch from for the current selection.
  const targets = useMemo<NodeId[]>(() => {
    if (node === 'jm') return ['jm']
    if (node === 'all') return ['jm', ...httpTms.map((t) => t.tm_id)]
    return [node]
  }, [node, httpTms])

  const query: LogQuery = { level, limit: LIMIT, source: source || undefined }
  const refetchInterval = follow ? 2500 : false

  const results = useQueries({
    queries: targets.map((t) => ({
      queryKey: t === 'jm' ? qk.logs(query) : qk.tmLogs(t, query),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        t === 'jm' ? api.logs(query, signal) : api.tmLogs(t, query, signal),
      refetchInterval,
    })),
  })

  const merged = useMemo<LogRecord[]>(() => {
    const multi = targets.length > 1
    const out: LogRecord[] = []
    results.forEach((r, i) => {
      const nodeId = targets[i]
      for (const rec of r.data ?? []) {
        out.push(multi ? { ...rec, source: `${nodeId}/${rec.source}` } : rec)
      }
    })
    return out.sort((a, b) => a.ts_ms - b.ts_ms).slice(-2000)
  }, [results, targets])

  const anyError = results.find((r) => r.isError)
  const knownSources = components.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        description="Cluster-wide log stream. The JobManager and every HTTP-enabled TaskManager are merged by timestamp."
        actions={
          <Button variant={follow ? 'default' : 'outline'} size="sm" onClick={() => setFollow((f) => !f)}>
            {follow ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {follow ? 'Following' : 'Paused'}
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <Field label="Node">
            <Select value={node} onValueChange={setNode}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All nodes</SelectItem>
                <SelectItem value="jm">JobManager</SelectItem>
                {httpTms.map((t) => (
                  <SelectItem key={t.tm_id} value={t.tm_id}>
                    {t.tm_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Min level">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Source prefix">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                list="log-sources"
                placeholder="e.g. jm. / tm. / autoscaler"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="pl-8"
              />
              <datalist id="log-sources">
                {knownSources.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </Field>

          <div className="ml-auto flex items-center gap-2 pb-0.5 text-xs text-muted-foreground">
            <Badge variant="muted">{merged.length} lines</Badge>
            {targets.length > 1 && <Badge variant="muted">{targets.length} nodes</Badge>}
          </div>
        </CardContent>
      </Card>

      {anyError ? (
        <ErrorState error={anyError.error} />
      ) : (
        <LogViewer records={merged} follow={follow} heightClass="h-[64vh]" emptyLabel="No matching log records" />
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  )
}
