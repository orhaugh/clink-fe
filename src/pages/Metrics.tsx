import { useEffect, useRef, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useMetricsText } from '@/hooks/useApi'
import { PageHeader } from '@/components/PageHeader'
import { MetricsPanel } from '@/components/MetricsPanel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { familyTotal, toView } from '@/lib/prometheus'
import { fmtTime } from '@/lib/format'

interface Point {
  t: number
  completed?: number
  failed?: number
  triggered?: number
  cpu?: number
  rssMib?: number
}

const MAX_POINTS = 80

// Headline counters charted as a rolling session history (the /metrics endpoint
// is point-in-time, so we accumulate client-side while the page is open).
const SERIES = [
  { key: 'completed', name: 'Checkpoints completed', color: '#34d399' },
  { key: 'triggered', name: 'Triggered', color: '#22d3ee' },
  { key: 'failed', name: 'Failed', color: '#f87171' },
] as const

export function Metrics() {
  const metrics = useMetricsText()
  const [history, setHistory] = useState<Point[]>([])
  const lastUpdate = useRef(0)

  useEffect(() => {
    if (!metrics.data || metrics.dataUpdatedAt === lastUpdate.current) return
    lastUpdate.current = metrics.dataUpdatedAt
    const v = toView(metrics.data)
    const rss = familyTotal(v, 'clink_process_resident_memory_bytes')
    const point: Point = {
      t: metrics.dataUpdatedAt || Date.now(),
      completed: familyTotal(v, 'clink_ckpt_completed_total'),
      triggered: familyTotal(v, 'clink_ckpt_triggered_total'),
      failed: familyTotal(v, 'clink_ckpt_failed_total'),
      cpu: familyTotal(v, 'clink_process_cpu_percent'),
      rssMib: rss != null ? Math.round(rss / (1024 * 1024)) : undefined,
    }
    setHistory((prev) => [...prev, point].slice(-MAX_POINTS))
  }, [metrics.data, metrics.dataUpdatedAt])

  const hasSeries = history.some((p) => p.completed != null || p.triggered != null || p.failed != null)
  const hasResources = history.some((p) => p.cpu != null || p.rssMib != null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metrics"
        description="Live Coordinator metrics, parsed from the Prometheus exposition. Per-Worker metrics live on each worker's detail page."
      />

      {hasSeries && history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Checkpoints (session)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 20% 22%)" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => fmtTime(t).slice(0, 8)}
                    stroke="hsl(215 18% 60%)"
                    fontSize={11}
                  />
                  <YAxis stroke="hsl(215 18% 60%)" fontSize={11} width={48} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{
                      background: 'hsl(222 26% 9%)',
                      border: '1px solid hsl(217 20% 18%)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(t) => fmtTime(Number(t))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {SERIES.map((s) => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {hasResources && history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>CPU &amp; memory (session)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(217 20% 22%)" />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(t) => fmtTime(t).slice(0, 8)}
                    stroke="hsl(215 18% 60%)"
                    fontSize={11}
                  />
                  <YAxis yAxisId="cpu" stroke="#22d3ee" fontSize={11} width={44} unit="%" />
                  <YAxis yAxisId="mem" orientation="right" stroke="#a78bfa" fontSize={11} width={56} unit="M" />
                  <RTooltip
                    contentStyle={{
                      background: 'hsl(222 26% 9%)',
                      border: '1px solid hsl(217 20% 18%)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(t) => fmtTime(Number(t))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line yAxisId="cpu" type="monotone" dataKey="cpu" name="CPU %" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                  <Line yAxisId="mem" type="monotone" dataKey="rssMib" name="RSS (MiB)" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <MetricsPanel text={metrics.data} isLoading={metrics.isLoading} isError={metrics.isError} error={metrics.error} />
    </div>
  )
}
