import { useMemo, useState } from 'react'
import { Boxes, Plug, Search } from 'lucide-react'
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
import type { SqlConnector } from '@/lib/types'

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectors"
        description={
          <>
            The WITH (connector='...') values this build understands.{' '}
            <span className="text-muted-foreground/80">
              A connector only works at submit time if its impl is linked into the running build.
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
                          <TableHead className="w-1/4">Connector</TableHead>
                          <TableHead className="w-40">Capability</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((c) => (
                          <TableRow key={c.name}>
                            <TableCell className="font-mono text-foreground">{c.name}</TableCell>
                            <TableCell>
                              <CapabilityBadges source={c.source} sink={c.sink} />
                            </TableCell>
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
