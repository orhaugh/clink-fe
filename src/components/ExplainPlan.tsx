import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { SqlPlanEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

// A parsed plan node: indentation depth, the node kind (first token) and the
// trailing schema text (the [..] block).
interface PlanNode {
  depth: number
  kind: string
  schema: string
}

type Tone = NonNullable<BadgeProps['variant']>

// Map a node kind to a badge tone by family. The match is case-insensitive and
// substring-based so variants (EquiJoin, IntervalJoin, GroupBy, ...) share a tone.
function toneFor(kind: string): Tone {
  const k = kind.toLowerCase()
  if (k.includes('sink')) return 'danger'
  if (k.includes('source') || k.includes('scan')) return 'ok'
  if (k.includes('join')) return 'warn'
  if (k.includes('aggregate') || k.includes('groupby') || k.includes('group')) return 'info'
  if (
    k.includes('window') ||
    k.includes('tumble') ||
    k.includes('hop') ||
    k.includes('cumulate') ||
    k.includes('session')
  )
    return 'info'
  if (k.includes('project')) return 'default'
  if (k.includes('filter')) return 'warn'
  if (k.includes('async') || k.includes('map')) return 'muted'
  return 'secondary'
}

// Split a plan line into depth / kind / schema. Two leading spaces = one level.
function parseLine(line: string): PlanNode | null {
  if (!line.trim()) return null
  const leading = line.length - line.trimStart().length
  const depth = Math.floor(leading / 2)
  const body = line.trim()
  // The schema block is the trailing [...]; everything before it is the kind.
  const open = body.indexOf('[')
  let kind = body
  let schema = ''
  if (open >= 0) {
    kind = body.slice(0, open).trim()
    schema = body.slice(open).trim()
  }
  // The kind is the first token (e.g. "EquiJoin INNER" -> keep the full label).
  return { depth, kind, schema }
}

function parsePlan(explain: string): PlanNode[] {
  return explain
    .split('\n')
    .map(parseLine)
    .filter((n): n is PlanNode => n !== null)
}

function PlanTree({ nodes }: { nodes: PlanNode[] }) {
  if (nodes.length === 0) {
    return <div className="text-sm text-muted-foreground">No plan produced.</div>
  }
  // Normalise depths to the shallowest node so the tree hugs the left edge.
  const minDepth = Math.min(...nodes.map((n) => n.depth))
  return (
    <div className="space-y-1">
      {nodes.map((n, i) => {
        const indent = n.depth - minDepth
        return (
          <div key={i} className="flex items-start gap-2">
            {/* Indentation rails: one bordered cell per level. */}
            {Array.from({ length: indent }).map((_, d) => (
              <span key={d} className="ml-[7px] h-5 w-3 shrink-0 border-l border-border" />
            ))}
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <Badge variant={toneFor(n.kind)} className="shrink-0 font-mono">
                {n.kind}
              </Badge>
              {n.schema && (
                <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{n.schema}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ExplainPlan({ plans }: { plans: SqlPlanEntry[] }) {
  if (!plans || plans.length === 0) {
    return <div className="text-sm text-muted-foreground">No plans returned.</div>
  }
  const multiple = plans.length > 1
  return (
    <div className="space-y-4">
      {plans.map((p, i) => (
        <div key={i} className="space-y-2">
          {multiple && (
            <div className={cn('text-xs font-medium uppercase tracking-wide text-muted-foreground')}>
              {p.kind}
            </div>
          )}
          <PlanTree nodes={parsePlan(p.explain)} />
        </div>
      ))}
    </div>
  )
}
