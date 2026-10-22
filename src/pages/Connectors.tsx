import { useMemo, useState } from 'react'
import { Boxes, Lock, Plug, Search, ShieldCheck } from 'lucide-react'
import { useConnectors } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ErrorState, LoadingState, EmptyState } from '@/components/States'
import { DeliveryBadge } from '@/components/StatusBadge'
import { isExactlyOnceDelivery } from '@/lib/guarantees'
import type { ConnectorVariant, SqlConnector } from '@/lib/types'

// Short, factual one-line descriptions keyed by connector name. Anything not
// listed here renders with a blank description rather than an invented one.
const DESCRIPTIONS: Record<string, string> = {
  kafka: 'Apache Kafka topics',
  pulsar: 'Apache Pulsar topics',
  rabbitmq: 'RabbitMQ / AMQP queues',
  nats: 'NATS JetStream',
  pubsub: 'Google Cloud Pub/Sub',
  kinesis: 'AWS Kinesis streams',
  firehose: 'AWS Kinesis Firehose',
  file: 'Local files',
  filesystem: 'Local filesystem',
  parquet: 'Local Parquet files',
  s3: 'Amazon S3 objects',
  s3_parquet: 'Parquet on Amazon S3',
  gcs_parquet: 'Parquet on Google Cloud Storage',
  azure_parquet: 'Parquet on Azure Blob Storage',
  webhdfs_parquet: 'Parquet over WebHDFS / HttpFS',
  iceberg: 'Apache Iceberg tables',
  delta: 'Delta Lake tables',
  postgres: 'PostgreSQL tables / CDC',
  mysql: 'MySQL tables / CDC',
  clickhouse: 'ClickHouse tables',
  cassandra: 'Cassandra / ScyllaDB',
  dynamodb: 'AWS DynamoDB',
  redis: 'Redis streams',
  http: 'HTTP endpoints',
  http_poll: 'HTTP polling source',
  elasticsearch: 'Elasticsearch indices',
  opensearch: 'OpenSearch indices',
  splunk: 'Splunk',
  splunk_hec: 'Splunk HEC',
  influxdb: 'InfluxDB',
  prometheus: 'Prometheus remote-write',
  blackhole: 'Discards output (testing)',
  nexmark: 'Nexmark benchmark source',
}

// Sections render in this order; any unrecognised category falls in after these
// under its own heading.
const CATEGORY_ORDER = ['messaging', 'storage', 'database', 'observability', 'testing']

const CATEGORY_LABEL: Record<string, string> = {
  messaging: 'Messaging',
  storage: 'Storage',
  database: 'Database',
  observability: 'Observability',
  testing: 'Testing',
}

function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
}

function CapabilityBadges({ source, sink }: { source: boolean; sink: boolean }) {
  if (!source && !sink) return <span className="text-xs text-muted-foreground">-</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {source && <Badge variant="ok">source</Badge>}
      {sink && <Badge variant="info">sink</Badge>}
    </div>
  )
}

// Whether THIS coordinator binary was built with the connector. The field is
// absent on a coordinator that predates it, which is "unknown", not "no".
function AvailabilityBadge({ available }: { available: boolean | undefined }) {
  if (available === undefined) return <span className="text-xs text-muted-foreground">-</span>
  return available ? (
    <Badge variant="ok">in this build</Badge>
  ) : (
    <Badge
      variant="muted"
      title="Not linked into the running coordinator; a submit using it is refused."
    >
      not built
    </Badge>
  )
}

// The capability records behind one vocabulary entry (kafka -> kafka,
// kafka_2pc). Each row is what the engine's delivery-guarantee analyser
// reads for an operator built on that record.
function VariantTable({ variants }: { variants: ConnectorVariant[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="py-1 pr-3 text-left font-medium">Record</th>
          <th className="py-1 pr-3 text-left font-medium">Role</th>
          <th className="py-1 pr-3 text-left font-medium">Delivery</th>
          <th className="py-1 pr-3 text-left font-medium">Commit</th>
          <th className="py-1 pr-3 text-left font-medium">Replay</th>
          <th className="py-1 pr-3 text-left font-medium">Offset model</th>
          <th className="py-1 pr-3 text-left font-medium">Checkpoint</th>
          <th className="py-1 pr-3 text-left font-medium">TLS</th>
          <th className="py-1 text-left font-medium">SQL</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v) => (
          <tr key={v.name} className="border-t border-border/40">
            <td className="py-1 pr-3 font-mono">{v.name}</td>
            <td className="py-1 pr-3 text-muted-foreground">
              {[v.source && 'source', v.sink && 'sink'].filter(Boolean).join(' + ') || '-'}
            </td>
            <td className="py-1 pr-3">
              <DeliveryBadge level={v.delivery} />
            </td>
            <td className="py-1 pr-3 text-muted-foreground">
              {v.transactional
                ? v.commit_recoverable
                  ? 'two-phase, recoverable'
                  : 'two-phase, needs confirmation'
                : '-'}
            </td>
            <td className="py-1 pr-3 text-muted-foreground">
              {v.source ? (v.replayable ? 'replays' : 'no replay') : '-'}
            </td>
            <td className="py-1 pr-3 font-mono text-muted-foreground">{v.offset_model}</td>
            <td className="py-1 pr-3 text-muted-foreground">
              {v.checkpoint_integrated ? 'participates' : '-'}
            </td>
            <td className="py-1 pr-3 text-muted-foreground">{v.tls ? 'yes' : '-'}</td>
            <td className="py-1 text-muted-foreground">{v.available_in_sql ? 'yes' : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// A build reports capability records when the coordinator is new enough; the
// extra columns are shown only then, so an older coordinator keeps the plain table.
function reportsCapabilities(connectors: SqlConnector[]): boolean {
  return connectors.some((c) => c.variants !== undefined)
}

export function Connectors() {
  const connectors = useConnectors()
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  // Filter by name, then group by category in the fixed section order. Any
  // category not in CATEGORY_ORDER is appended afterwards, alphabetically.
  const grouped = useMemo(() => {
    const all = connectors.data ?? []
    const filtered = q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all

    const byCategory = new Map<string, SqlConnector[]>()
    for (const c of filtered) {
      const list = byCategory.get(c.category) ?? []
      list.push(c)
      byCategory.set(c.category, list)
    }

    const known = CATEGORY_ORDER.filter((cat) => byCategory.has(cat))
    const extra = [...byCategory.keys()].filter((cat) => !CATEGORY_ORDER.includes(cat)).sort()

    return [...known, ...extra].map((category) => ({
      category,
      connectors: (byCategory.get(category) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [connectors.data, q])

  const total = connectors.data?.length ?? 0
  const withCapabilities = reportsCapabilities(connectors.data ?? [])
  const availableCount = (connectors.data ?? []).filter((c) => c.available).length
  const exactlyOnceSinks = (connectors.data ?? []).filter((c) =>
    isExactlyOnceDelivery(c.sink_delivery),
  ).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description={
          <>
            The WITH (connector='...') vocabulary, with what each connector declares: whether it is
            in this build, the strongest delivery its sink records offer, and whether its sources
            replay.{' '}
            <span className="text-muted-foreground/80">
              A job&apos;s end-to-end guarantee is the weakest link across its source, checkpointing
              and sinks; see the job page for the verdict.
            </span>
          </>
        }
      />

      {connectors.isError ? (
        <Card>
          <CardContent className="px-0 py-0">
            <ErrorState error={connectors.error} />
          </CardContent>
        </Card>
      ) : connectors.isLoading || !connectors.data ? (
        <Card>
          <CardContent className="px-0 py-0">
            <LoadingState />
          </CardContent>
        </Card>
      ) : (
        <>
          {total > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="Connectors" value={total} icon={Plug} />
              <StatCard
                label="Categories"
                value={connectorCategoryTotal(connectors.data)}
                icon={Boxes}
              />
              <StatCard
                label="Sources"
                value={connectors.data.filter((c) => c.source).length}
                tone="ok"
              />
              <StatCard
                label="Sinks"
                value={connectors.data.filter((c) => c.sink).length}
                tone="info"
              />
              <StatCard
                label="In this build"
                value={withCapabilities ? availableCount : '-'}
                sub={withCapabilities ? `of ${total} known` : 'not reported'}
                icon={Lock}
              />
              <StatCard
                label="Exactly-once sinks"
                value={withCapabilities ? exactlyOnceSinks : '-'}
                sub={withCapabilities ? 'two-phase or atomic publish' : 'not reported'}
                icon={ShieldCheck}
                tone="ok"
              />
            </div>
          )}

          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by connector name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          {total === 0 ? (
            <Card>
              <CardContent className="px-0 py-0">
                <EmptyState
                  label="No connectors reported"
                  hint="This build has no SQL connector impls linked in."
                />
              </CardContent>
            </Card>
          ) : grouped.length === 0 ? (
            <Card>
              <CardContent className="px-0 py-0">
                <EmptyState
                  label={`No connectors match "${query}"`}
                  hint="Clear the filter to see all of them."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {grouped.map(({ category, connectors: items }) => (
                <Card key={category}>
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle>{categoryLabel(category)}</CardTitle>
                    <Badge variant="muted">{items.length}</Badge>
                  </CardHeader>
                  <CardContent className="px-0 pb-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-1/5">Connector</TableHead>
                          <TableHead className="w-36">Capability</TableHead>
                          {withCapabilities && (
                            <>
                              <TableHead>Build</TableHead>
                              <TableHead>Sink delivery</TableHead>
                              <TableHead>Source replay</TableHead>
                              <TableHead>TLS</TableHead>
                            </>
                          )}
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-mono text-foreground">
                              {c.name}
                              {c.variants && c.variants.length > 0 && (
                                <details className="mt-1 font-sans">
                                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                    {c.variants.length} record{c.variants.length === 1 ? '' : 's'}
                                  </summary>
                                  <div className="mt-2 overflow-x-auto rounded-md border border-border/60 bg-muted/20 p-2">
                                    <VariantTable variants={c.variants} />
                                  </div>
                                </details>
                              )}
                            </TableCell>
                            <TableCell>
                              <CapabilityBadges source={c.source} sink={c.sink} />
                            </TableCell>
                            {withCapabilities && (
                              <>
                                <TableCell>
                                  <AvailabilityBadge available={c.available} />
                                </TableCell>
                                <TableCell>
                                  {c.sink ? (
                                    <DeliveryBadge level={c.sink_delivery} />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {c.source
                                    ? c.source_replayable
                                      ? 'replays from a recorded position'
                                      : c.variants && c.variants.length > 0
                                        ? 'no replay'
                                        : '-'
                                    : '-'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {c.tls ? 'yes' : '-'}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-muted-foreground">
                              {DESCRIPTIONS[c.name] ?? ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function connectorCategoryTotal(connectors: SqlConnector[]): number {
  return new Set(connectors.map((c) => c.category)).size
}
