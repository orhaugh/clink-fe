import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { fmtCount, fmtBytes, fmtRelative, fmtMs } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OperatorRuntime } from '@/lib/types'

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm" title={hint}>
        {value}
      </div>
    </div>
  )
}

export function OperatorDetail({ op, onClose }: { op: OperatorRuntime | null; onClose: () => void }) {
  const open = op != null
  const cap = op?.input_capacity ?? 0
  const bp = cap > 0 ? (op!.input_depth ?? 0) / cap : 0
  const bpColor = bp >= 0.9 ? 'text-danger' : bp >= 0.5 ? 'text-warn' : 'text-ok'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {op && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-sm">
                <span>{op.display_name || op.op_type}</span>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">×{op.parallelism}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{op.kind}</span>
                {op.keyed && <span className="rounded bg-warn/20 px-1.5 py-0.5 text-[10px] text-warn">keyed</span>}
                {op.stale && <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[10px] text-danger">stale</span>}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-muted-foreground">
                <span>node {op.node}</span>
                {op.op_id && <span>op_id {op.op_id}</span>}
                {op.uid && <span>uid {op.uid}</span>}
                <span>channel {op.op_type}</span>
              </div>

              {op.metrics_available ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="records in" value={fmtCount(op.records_in)} hint={String(op.records_in)} />
                  <Stat label="records out" value={fmtCount(op.records_out)} hint={String(op.records_out)} />
                  <Stat label="dropped" value={fmtCount(op.records_dropped)} hint={String(op.records_dropped)} />
                  <Stat label="side output" value={fmtCount(op.side_output)} hint={String(op.side_output)} />
                  <Stat label="bytes sent" value={fmtBytes(op.bytes_sent)} hint={String(op.bytes_sent)} />
                  <Stat label="bytes received" value={fmtBytes(op.bytes_received)} hint={String(op.bytes_received)} />
                  <div className="rounded-md border border-border bg-card px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">backpressure</div>
                    <div className={cn('font-mono text-sm', bpColor)}>
                      {cap > 0 ? `${(bp * 100).toFixed(0)}%` : 'n/a'}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70">
                      {op.input_depth} / {op.input_capacity} queued
                    </div>
                  </div>
                  <Stat
                    label="watermark"
                    value={op.has_watermark && op.watermark_ms != null ? fmtRelative(op.watermark_ms) : 'n/a'}
                    hint={op.watermark_ms != null ? String(op.watermark_ms) : undefined}
                  />
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-muted-foreground">
                  {op.stale ? 'A hosting Worker was unreachable.' : 'No runtime metrics reported yet.'}
                </div>
              )}

              {op.accumulators && Object.keys(op.accumulators).length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    accumulators
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Object.entries(op.accumulators).map(([name, val]) => (
                      <Stat key={name} label={name} value={fmtCount(val)} hint={String(val)} />
                    ))}
                  </div>
                </div>
              )}

              {op.subtasks.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    subtask placement ({op.subtasks.length})
                  </div>
                  <div className="max-h-32 overflow-auto rounded-md border border-border">
                    <table className="w-full font-mono text-[11px]">
                      <thead className="sticky top-0 bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">subtask</th>
                          <th className="px-2 py-1 text-left">worker</th>
                          <th className="px-2 py-1 text-left">started</th>
                          <th className="px-2 py-1 text-right">duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {op.subtasks.map((s) => {
                          const started = s.started_at_unix_ms || 0
                          const finished = s.finished_at_unix_ms || 0
                          const dur = started ? (finished || Date.now()) - started : 0
                          return (
                            <tr key={`${s.subtask_idx}-${s.worker_id}`} className="border-t border-border/60">
                              <td className="px-2 py-1">#{s.subtask_idx}</td>
                              <td className="px-2 py-1">{s.worker_id}</td>
                              <td className="px-2 py-1">{started ? fmtRelative(started) : '-'}</td>
                              <td className="px-2 py-1 text-right">
                                {started ? `${finished ? '' : '~'}${fmtMs(dur)}` : '-'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {op.per_worker.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    per worker
                  </div>
                  <div className="overflow-auto rounded-md border border-border">
                    <table className="w-full font-mono text-[11px]">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-2 py-1 text-left">worker</th>
                          <th className="px-2 py-1 text-right">in</th>
                          <th className="px-2 py-1 text-right">out</th>
                          <th className="px-2 py-1 text-right">queued</th>
                        </tr>
                      </thead>
                      <tbody>
                        {op.per_worker.map((t) => (
                          <tr key={t.worker_id} className="border-t border-border/60">
                            <td className="px-2 py-1">{t.worker_id}</td>
                            <td className="px-2 py-1 text-right">{fmtCount(t.records_in)}</td>
                            <td className="px-2 py-1 text-right">{fmtCount(t.records_out)}</td>
                            <td className="px-2 py-1 text-right">
                              {t.input_capacity > 0 ? `${t.input_depth}/${t.input_capacity}` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
