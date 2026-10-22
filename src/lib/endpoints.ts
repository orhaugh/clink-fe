// The sources and sinks of a job, joined from three read-only views:
//
// - the retained topology (GET /jobs/:id/graph) says which nodes are sources
//   and sinks, their op types and parallelism;
// - the lineage (GET /jobs/:id/lineage) names the external datasets each one
//   reads or writes (topic, table, path);
// - the connector vocabulary (GET /connectors) carries the capability record
//   each op type was built on, and with it the delivery the connector
//   declares.
//
// The join never invents a fact: a node without a lineage vertex shows no
// dataset, and a node whose op type matches no record shows no connector.

import type {
  ConnectorVariant,
  JobGraphDetail,
  JobLineage,
  JobOperators,
  LineageDataset,
  OperatorRuntime,
  SqlConnector,
} from './types'

export interface ConnectorMatch {
  connector: SqlConnector
  // The capability record the op type resolved to; absent when the
  // coordinator reports no variants (older builds) and only the vocabulary
  // entry matched.
  variant?: ConnectorVariant
}

// Mirrors the coordinator's connector_name_for_op_type
// (src/cluster/guarantee_gate.cpp): the longest record name that is a prefix
// of the op type wins, so "kafka_2pc_sink_string" resolves to kafka_2pc and
// never to kafka (the two carry different guarantees, and the shorter match
// would over-promise). The one exception the gate carries is kept: the SQL
// row Parquet 2PC sink is named for the parquet_2pc record.
export function connectorForOpType(
  opType: string,
  connectors: SqlConnector[] | undefined,
): ConnectorMatch | null {
  if (!opType || !connectors || connectors.length === 0) return null
  const probe = opType.startsWith('parquet_row_2pc_sink') ? 'parquet_2pc' : opType
  let best: ConnectorMatch | null = null
  let bestLen = 0
  for (const c of connectors) {
    for (const v of c.variants ?? []) {
      if (probe.startsWith(v.name) && v.name.length > bestLen) {
        best = { connector: c, variant: v }
        bestLen = v.name.length
      }
    }
  }
  if (best) return best
  // No records at all (a coordinator that predates them): fall back to the
  // vocabulary entry, which still identifies the connector family.
  for (const c of connectors) {
    if (probe.startsWith(c.name) && c.name.length > bestLen) {
      best = { connector: c }
      bestLen = c.name.length
    }
  }
  return best
}

export type EndpointKind = 'source' | 'sink'

export interface EndpointRow {
  id: string
  kind: EndpointKind
  name: string
  opType: string
  parallelism: number
  match: ConnectorMatch | null
  datasets: LineageDataset[]
  boundedness?: string
  stats?: OperatorRuntime
}

export function endpointRows(
  graph: JobGraphDetail | undefined,
  ops: JobOperators | undefined,
  lineage: JobLineage | undefined,
  connectors: SqlConnector[] | undefined,
): EndpointRow[] {
  if (!graph?.available) return []
  const statsByNode = new Map<string, OperatorRuntime>()
  for (const o of ops?.operators ?? []) statsByNode.set(o.node, o)

  // Lineage vertices carry the graph-local operator id and the uid, so a
  // vertex is looked up by id first and by uid when the ids disagree.
  const byId = new Map<string, { datasets: LineageDataset[]; boundedness?: string }>()
  const byUid = new Map<string, { datasets: LineageDataset[]; boundedness?: string }>()
  if (lineage?.available) {
    for (const v of [...lineage.lineage.sources, ...lineage.lineage.sinks]) {
      const entry = { datasets: v.datasets, boundedness: v.boundedness }
      byId.set(v.id, entry)
      if (v.uid) byUid.set(v.uid, entry)
    }
  }

  const rows: EndpointRow[] = []
  for (const n of graph.nodes) {
    if (n.kind !== 'source' && n.kind !== 'sink') continue
    const lin = byId.get(n.id) ?? (n.uid ? byUid.get(n.uid) : undefined)
    rows.push({
      id: n.id,
      kind: n.kind,
      name: n.display_name || n.op_type,
      opType: n.op_type,
      parallelism: n.parallelism,
      match: connectorForOpType(n.op_type, connectors),
      datasets: lin?.datasets ?? [],
      boundedness: lin?.boundedness,
      stats: statsByNode.get(n.id),
    })
  }
  // Sources first, each group in topology order.
  return [...rows.filter((r) => r.kind === 'source'), ...rows.filter((r) => r.kind === 'sink')]
}

// The dataset's namespace (its storage address: a broker list, a connector
// family) and name (topic, table, path) as one line; the facets stay on the
// lineage panel. A space, not a slash, because a path name is already
// absolute ("file" + "/tmp/out.ndjson").
export function datasetLabel(d: LineageDataset): string {
  return d.namespace ? `${d.namespace} ${d.name}` : d.name
}
