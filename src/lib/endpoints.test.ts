import { describe, it, expect } from 'vitest'
import { connectorForOpType, datasetLabel, endpointRows } from './endpoints'
import type {
  ConnectorVariant,
  JobGraphDetail,
  JobLineage,
  JobOperators,
  OperatorRuntime,
  SqlConnector,
} from './types'

function variant(name: string, over: Partial<ConnectorVariant> = {}): ConnectorVariant {
  return {
    name,
    source: true,
    sink: true,
    delivery: 'at_least_once',
    transactional: false,
    commit_recoverable: true,
    replayable: true,
    offset_model: 'log_offset',
    checkpoint_integrated: true,
    tls: false,
    available_in_sql: true,
    ...over,
  }
}

const connectors: SqlConnector[] = [
  {
    name: 'kafka',
    source: true,
    sink: true,
    category: 'messaging',
    variants: [
      variant('kafka'),
      variant('kafka_2pc', { source: false, delivery: 'exactly_once_two_phase_commit' }),
    ],
  },
  {
    name: 'parquet',
    source: true,
    sink: true,
    category: 'storage',
    variants: [
      variant('parquet'),
      variant('parquet_2pc', { delivery: 'exactly_once_atomic_publish' }),
    ],
  },
  { name: 'blackhole', source: false, sink: true, category: 'testing', variants: [] },
  { name: 'nexmark', source: true, sink: false, category: 'testing' },
]

describe('connectorForOpType', () => {
  it('takes the longest record prefix, never the shorter family name', () => {
    expect(connectorForOpType('kafka_2pc_sink_string', connectors)?.variant?.name).toBe('kafka_2pc')
    expect(connectorForOpType('kafka_source', connectors)?.variant?.name).toBe('kafka')
  })

  it('keeps the gate special case for the SQL row Parquet 2PC sink', () => {
    expect(connectorForOpType('parquet_row_2pc_sink', connectors)?.variant?.name).toBe(
      'parquet_2pc',
    )
  })

  it('falls back to the vocabulary entry when a build reports no records', () => {
    const m = connectorForOpType('nexmark_source', connectors)
    expect(m?.connector.name).toBe('nexmark')
    expect(m?.variant).toBeUndefined()
    expect(connectorForOpType('blackhole_sink_row', connectors)?.connector.name).toBe('blackhole')
  })

  it('is null without a match, an op type or a vocabulary', () => {
    expect(connectorForOpType('map_fn', connectors)).toBeNull()
    expect(connectorForOpType('', connectors)).toBeNull()
    expect(connectorForOpType('kafka_source', undefined)).toBeNull()
    expect(connectorForOpType('kafka_source', [])).toBeNull()
  })
})

function node(
  id: string,
  kind: string,
  op_type: string,
  uid = '',
): JobGraphDetail['nodes'][number] {
  return {
    id,
    op_type,
    display_name: '',
    uid,
    kind,
    parallelism: 2,
    out_channel: 'row',
    keyed: false,
    subtasks: [],
  }
}

const graph: JobGraphDetail = {
  job_id: 1,
  topology_version: 1,
  available: true,
  nodes: [
    node('n0', 'source', 'kafka_source', 'src'),
    node('n1', 'operator', 'map'),
    node('n2', 'sink', 'kafka_2pc_sink_string'),
  ],
  edges: [],
}

const lineage: JobLineage = {
  job_id: 1,
  available: true,
  lineage: {
    sources: [
      {
        id: 'other-id',
        uid: 'src',
        name: 'events',
        op_type: 'kafka_source',
        boundedness: 'unbounded',
        datasets: [{ namespace: 'kafka://b:9092', name: 'events', facets: {} }],
      },
    ],
    sinks: [
      {
        id: 'n2',
        uid: '',
        name: 'alerts',
        op_type: 'kafka_2pc_sink_string',
        datasets: [{ namespace: 'kafka://b:9092', name: 'alerts', facets: {} }],
      },
    ],
    edges: [],
  },
}

function runtime(nodeId: string, over: Partial<OperatorRuntime> = {}): OperatorRuntime {
  return {
    node: nodeId,
    op_id: '',
    uid: '',
    kind: 'source',
    op_type: '',
    display_name: '',
    parallelism: 1,
    keyed: false,
    metrics_available: true,
    stale: false,
    records_in: 0,
    records_out: 10,
    records_dropped: 0,
    side_output: 0,
    bytes_sent: 0,
    bytes_received: 0,
    input_depth: 0,
    input_capacity: 0,
    has_watermark: false,
    accumulators: {},
    subtasks: [],
    per_worker: [],
    ...over,
  }
}

const ops: JobOperators = { job_id: 1, available: true, operators: [runtime('n0'), runtime('n2')] }

describe('endpointRows', () => {
  it('joins topology, lineage (by id or uid) and connector records, sources first', () => {
    const rows = endpointRows(graph, ops, lineage, connectors)
    expect(rows.map((r) => [r.id, r.kind])).toEqual([
      ['n0', 'source'],
      ['n2', 'sink'],
    ])
    expect(rows[0]).toMatchObject({
      name: 'kafka_source',
      parallelism: 2,
      boundedness: 'unbounded',
      datasets: [{ name: 'events' }],
    })
    expect(rows[0].match?.variant?.name).toBe('kafka')
    expect(rows[0].stats?.records_out).toBe(10)
    expect(rows[1].match?.variant?.delivery).toBe('exactly_once_two_phase_commit')
    expect(rows[1].datasets[0].name).toBe('alerts')
  })

  it('shows no dataset, connector or stats when those views are missing', () => {
    const rows = endpointRows(graph, undefined, undefined, undefined)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ match: null, datasets: [], stats: undefined })
    const unavailable: JobLineage = { job_id: 1, available: false, lineage: lineage.lineage }
    expect(endpointRows(graph, ops, unavailable, connectors)[1].datasets).toEqual([])
  })

  it('gives a source the watermark of the operator downstream that assigns it', () => {
    // n0 (source) -> n1 (the assigner) -> n2 (sink); only the assigner has a watermark.
    const chained: JobGraphDetail = {
      ...graph,
      edges: [
        { from: 'n0', to: 'n1', routing: 'forward', channel: 'row' },
        { from: 'n1', to: 'n2', routing: 'forward', channel: 'row' },
      ],
    }
    const withAssigner: JobOperators = {
      ...ops,
      operators: [
        runtime('n0'),
        runtime('n1', { has_watermark: true, watermark_ms: 1_700_000_000_000 }),
        runtime('n2'),
      ],
    }
    const rows = endpointRows(chained, withAssigner, lineage, connectors)
    expect(rows[0]).toMatchObject({ watermarkMs: 1_700_000_000_000, watermarkVia: 'n1' })
    // A sink shows only its own, and a source with its own keeps it.
    expect(rows[1].watermarkMs).toBeUndefined()
    const own: JobOperators = {
      ...ops,
      operators: [runtime('n0', { has_watermark: true, watermark_ms: 5 }), runtime('n2')],
    }
    const kept = endpointRows(chained, own, lineage, connectors)[0]
    expect(kept.watermarkMs).toBe(5)
    expect(kept.watermarkVia).toBeUndefined()
    // No operator downstream reports one: nothing to show.
    expect(endpointRows(chained, ops, lineage, connectors)[0].watermarkMs).toBeUndefined()
  })

  it('is empty without a retained topology', () => {
    expect(endpointRows(undefined, ops, lineage, connectors)).toEqual([])
    expect(endpointRows({ ...graph, available: false }, ops, lineage, connectors)).toEqual([])
  })
})

describe('datasetLabel', () => {
  it('puts the namespace before the name, or gives the bare name', () => {
    expect(datasetLabel({ namespace: 'kafka://b', name: 't', facets: {} })).toBe('kafka://b t')
    expect(datasetLabel({ namespace: 'file', name: '/tmp/x', facets: {} })).toBe('file /tmp/x')
    expect(datasetLabel({ namespace: '', name: '/tmp/x', facets: {} })).toBe('/tmp/x')
  })
})
