import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FileCode2,
  KeyRound,
  Play,
  Send,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { SqlEditor } from '@/components/SqlEditor'
import { ExplainPlan } from '@/components/ExplainPlan'
import { ErrorState } from '@/components/States'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { useCatalog, useConnectors, useRunSql } from '@/hooks/useApi'
import { cn } from '@/lib/utils'
import type { CatalogTable, SqlMode, SqlResult } from '@/lib/types'

const STARTER = `-- Define a source + sink, then run a query.
-- DDL accumulates in the JobManager's session catalogue (see the panel on the left).
--
-- CREATE TABLE clicks (user_id BIGINT, url TEXT)
--   WITH (connector='kafka', topic='clicks', bootstrap='localhost:9092');
-- CREATE TABLE hits (user_id BIGINT)
--   WITH (connector='file', format='json', path='/tmp/hits.ndjson');
-- INSERT INTO hits SELECT user_id FROM clicks;
`

type Tone = NonNullable<BadgeProps['variant']>

function kindTone(kind: string): Tone {
  switch (kind) {
    case 'view':
      return 'info'
    case 'materialized_view':
      return 'warn'
    case 'lookup':
      return 'muted'
    default:
      return 'default'
  }
}

function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}

function CatalogueRow({
  table,
  expanded,
  onToggle,
  onInsert,
}: {
  table: CatalogTable
  expanded: boolean
  onToggle: () => void
  onInsert: (name: string) => void
}) {
  const pk = new Set(table.primary_key ?? [])
  return (
    <div className="rounded-md border border-border/60">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-accent/50"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span
          className="min-w-0 flex-1 truncate font-mono"
          onClick={(e) => {
            e.stopPropagation()
            onInsert(table.name)
          }}
          title="Click to insert into the editor"
        >
          {table.name}
        </span>
        <Badge variant={kindTone(table.kind)} className="shrink-0">
          {table.kind === 'materialized_view' ? 'matview' : table.kind}
        </Badge>
      </button>
      {expanded && (
        <div className="space-y-1 border-t border-border/60 px-3 py-2">
          {table.connector && (
            <div className="text-xs text-muted-foreground">
              connector <span className="font-mono text-foreground">{table.connector}</span>
            </div>
          )}
          {table.columns.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5 font-mono text-xs">
              {pk.has(c.name) && <KeyRound className="h-3 w-3 text-warn" />}
              <span className={cn(pk.has(c.name) ? 'text-foreground' : 'text-muted-foreground')}>
                {c.name}
              </span>
              <span className="text-muted-foreground/60">{c.type}</span>
            </div>
          ))}
          {table.columns.length === 0 && (
            <div className="text-xs text-muted-foreground">no columns</div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultPanel({ mode, result }: { mode: SqlMode; result: SqlResult }) {
  if (!result.ok) {
    return (
      <Card className="border-danger/40 p-4">
        <div className="text-sm font-medium text-danger">SQL error</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">{result.error}</div>
        {result.position != null && result.position > 0 && (
          <div className="mt-1 text-xs text-muted-foreground">at byte {result.position}</div>
        )}
      </Card>
    )
  }
  const applied = result.applied ?? 0
  const appliedNote = applied > 0 && (
    <div className="text-xs text-muted-foreground">
      {applied} DDL statement{applied === 1 ? '' : 's'} applied to the session catalogue
    </div>
  )

  if (mode === 'explain') {
    return (
      <div className="space-y-3">
        {appliedNote}
        {result.plans && result.plans.length > 0 ? (
          <Card className="p-4">
            <ExplainPlan plans={result.plans} />
          </Card>
        ) : (
          <div className="text-sm text-muted-foreground">
            No query to explain{applied > 0 ? ' (DDL only).' : '.'}
          </div>
        )}
      </div>
    )
  }

  if (mode === 'compile') {
    return (
      <div className="space-y-3">
        {appliedNote}
        {result.specs && result.specs.length > 0 ? (
          result.specs.map((s, i) => (
            <Card key={i} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm">{s.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(prettyJson(s.spec_json))}
                >
                  <Copy className="h-3.5 w-3.5" /> Copy spec
                </Button>
              </div>
              <pre className="max-h-80 overflow-auto rounded bg-muted/40 p-3 font-mono text-xs">
                {prettyJson(s.spec_json)}
              </pre>
            </Card>
          ))
        ) : (
          <div className="text-sm text-muted-foreground">
            No query to compile{applied > 0 ? ' (DDL only).' : '.'}
          </div>
        )}
      </div>
    )
  }

  // submit
  return (
    <div className="space-y-3">
      {appliedNote}
      {result.jobs && result.jobs.length > 0 ? (
        <Card className="border-ok/40 p-4">
          <div className="text-sm font-medium text-ok">
            Submitted {result.jobs.length} job{result.jobs.length === 1 ? '' : 's'}
          </div>
          <div className="mt-2 space-y-1">
            {result.jobs.map((j) => (
              <div key={j.job_id} className="flex items-center gap-2 text-sm">
                <span className="font-mono">{j.name}</span>
                <Link to={`/jobs/${j.job_id}`} className="text-primary hover:underline">
                  job {j.job_id} &rarr;
                </Link>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="text-sm text-muted-foreground">
          {applied > 0
            ? 'DDL applied; no INSERT / CREATE MATERIALIZED VIEW to submit.'
            : 'Nothing to submit.'}
        </div>
      )}
    </div>
  )
}

export function SqlWorkbench() {
  const catalog = useCatalog()
  const connectors = useConnectors()
  const runSql = useRunSql()

  const [sqlText, setSqlText] = useState(STARTER)
  const [parallelism, setParallelism] = useState(1)
  const [jobName, setJobName] = useState('')
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<SqlResult | undefined>()
  const [lastMode, setLastMode] = useState<SqlMode>('explain')

  const schema = useMemo(() => {
    const s: Record<string, string[]> = {}
    for (const t of catalog.data ?? []) s[t.name] = t.columns.map((c) => c.name)
    return s
  }, [catalog.data])

  const tables = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return (catalog.data ?? []).filter((t) => !f || t.name.toLowerCase().includes(f))
  }, [catalog.data, filter])

  const insert = (snippet: string) => setSqlText((t) => (t.endsWith('\n') || t === '' ? t : t + '\n') + snippet)

  const run = async (mode: SqlMode) => {
    setLastMode(mode)
    const res = await runSql.mutateAsync({
      sql: sqlText,
      mode,
      parallelism: parallelism > 1 ? parallelism : undefined,
      name: jobName.trim() || undefined,
    })
    setResult(res)
  }

  const busy = runSql.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="SQL workbench"
        description="Author clink SQL, inspect the plan, and submit straight to the cluster. DDL registers in the JobManager's session catalogue."
      />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Catalogue + connectors */}
        <div className="space-y-4">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Catalogue</span>
              <span className="text-xs text-muted-foreground">{tables.length}</span>
            </div>
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter tables"
              className="mb-2 h-8"
            />
            {catalog.isError ? (
              <ErrorState error={catalog.error} />
            ) : tables.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {catalog.isLoading ? 'Loading...' : 'No tables yet. Run a CREATE TABLE.'}
              </div>
            ) : (
              <div className="space-y-1">
                {tables.map((t) => (
                  <CatalogueRow
                    key={t.name}
                    table={t}
                    expanded={!!expanded[t.name]}
                    onToggle={() => setExpanded((e) => ({ ...e, [t.name]: !e[t.name] }))}
                    onInsert={insert}
                  />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Connectors</span>
              <Link to="/connectors" className="text-xs text-primary hover:underline">
                all &rarr;
              </Link>
            </div>
            <div className="flex flex-wrap gap-1">
              {(connectors.data ?? []).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => insert(`-- connector='${c.name}'`)}
                  title={`${c.source ? 'source' : ''}${c.source && c.sink ? ' + ' : ''}${c.sink ? 'sink' : ''}`}
                >
                  <Badge variant="muted" className="font-mono hover:bg-muted/80">
                    {c.name}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Editor + results */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Parallelism</label>
              <Input
                type="number"
                min={1}
                value={parallelism}
                onChange={(e) => setParallelism(Math.max(1, Number(e.target.value) || 1))}
                className="h-9 w-24"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Job name (optional)</label>
              <Input
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="sql_job"
                className="h-9 w-44"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" disabled={busy} onClick={() => void run('explain')}>
                <Play className="h-4 w-4" /> Explain
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void run('compile')}>
                <FileCode2 className="h-4 w-4" /> Compile
              </Button>
              <Button disabled={busy} onClick={() => void run('submit')}>
                <Send className="h-4 w-4" /> {busy ? 'Running...' : 'Submit'}
              </Button>
            </div>
          </div>

          <SqlEditor value={sqlText} onChange={setSqlText} schema={schema} height="360px" />

          {result ? (
            <ResultPanel mode={lastMode} result={result} />
          ) : (
            <div className="text-sm text-muted-foreground">
              Explain inspects the plan, Compile returns the JobGraphSpec, Submit runs it on the cluster.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
