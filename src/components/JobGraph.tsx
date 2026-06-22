import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { Database, KeyRound, Workflow as Cog, ArrowRightToLine, Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GraphEdge, GraphNode, JobGraphDetail } from '@/lib/types'

const NODE_W = 230
const NODE_H = 96

type OpData = { node: GraphNode; failed: boolean }

const kindStyle: Record<string, { ring: string; icon: typeof Database; label: string }> = {
  source: { ring: 'border-info/60', icon: Database, label: 'source' },
  sink: { ring: 'border-ok/60', icon: ArrowRightToLine, label: 'sink' },
  operator: { ring: 'border-border', icon: Cog, label: 'operator' },
}

function OperatorNode({ data }: NodeProps) {
  const { node, failed } = data as OpData
  const ks = kindStyle[node.kind] ?? kindStyle.operator
  const Icon = ks.icon
  // Group placement by TaskManager: "tm-1 x3".
  const perTm = new Map<string, number>()
  for (const s of node.subtasks) perTm.set(s.tm_id, (perTm.get(s.tm_id) ?? 0) + 1)
  const label = node.display_name || node.op_type

  return (
    <div
      className={cn(
        'w-[230px] rounded-lg border-2 bg-card shadow-md',
        failed ? 'border-danger/70' : ks.ring,
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-muted-foreground" />
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs font-medium" title={label}>
          {label}
        </span>
        {node.keyed && <KeyRound className="ml-auto h-3.5 w-3.5 shrink-0 text-warn" />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          ×{node.parallelism}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {node.out_channel}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">{ks.label}</span>
      </div>
      {perTm.size > 0 && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-1.5">
          <Server className="h-3 w-3 text-muted-foreground/60" />
          {[...perTm.entries()].map(([tm, n]) => (
            <span key={tm} className="rounded bg-secondary px-1 py-0.5 font-mono text-[10px] text-secondary-foreground">
              {tm}
              {n > 1 ? ` x${n}` : ''}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-muted-foreground" />
    </div>
  )
}

const nodeTypes = { op: OperatorNode }

const routingStyle: Record<string, { stroke: string; dash?: string; label?: string }> = {
  forward: { stroke: 'hsl(215 18% 45%)' },
  rebalance: { stroke: 'hsl(38 92% 56%)', dash: '6 4', label: 'rebalance' },
  hash: { stroke: 'hsl(190 95% 50%)', label: 'hash' },
}

function layout(graph: JobGraphDetail): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90, marginx: 12, marginy: 12 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of graph.nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
  for (const e of graph.edges) g.setEdge(e.from, e.to)
  dagre.layout(g)

  const failed = false // status overlay is layered by the caller via node data if needed
  const nodes: Node[] = graph.nodes.map((n) => {
    const p = g.node(n.id)
    return {
      id: n.id,
      type: 'op',
      position: { x: (p?.x ?? 0) - NODE_W / 2, y: (p?.y ?? 0) - NODE_H / 2 },
      data: { node: n, failed } satisfies OpData,
      draggable: true,
    }
  })

  const edges: Edge[] = graph.edges.map((e: GraphEdge, i) => {
    const rs = routingStyle[e.routing] ?? routingStyle.forward
    return {
      id: `e${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      animated: e.routing === 'hash',
      label: rs.label,
      labelStyle: { fill: rs.stroke, fontSize: 10, fontFamily: 'ui-monospace, monospace' },
      labelBgStyle: { fill: 'hsl(222 24% 10%)' },
      style: { stroke: rs.stroke, strokeWidth: 1.5, strokeDasharray: rs.dash },
    }
  })
  return { nodes, edges }
}

export function JobGraph({ graph, className }: { graph: JobGraphDetail; className?: string }) {
  const { nodes, edges } = useMemo(() => layout(graph), [graph])

  return (
    <div className={cn('h-[460px] w-full overflow-hidden rounded-lg border bg-background', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="hsl(217 20% 22%)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
