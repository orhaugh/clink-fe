// Per-job recovery (checkpoint) options a submission can carry.
//
// POST /api/v1/jobs/spec and POST /api/v1/jobs/sql?mode=submit read them from
// the query string (the coordinator's checkpoint_config_from_query). An unset
// option keeps the coordinator's default; a malformed one is refused with a
// 400 rather than silently defaulted, so the serialiser below only sends
// values that are well formed. Without a checkpoint_dir a job never
// checkpoints, so its exactly-once sinks never commit and a worker loss is
// not recoverable: the console shows that consequence next to the form.
//
// The plugin-upload path (POST /api/v1/jobs, multipart) takes none of these.

export type BarrierAlignment = 'aligned' | 'unaligned' | 'adaptive'

export const BARRIER_ALIGNMENTS: readonly BarrierAlignment[] = ['aligned', 'unaligned', 'adaptive']

export interface RecoveryOptions {
  checkpoint_dir?: string
  checkpoint_interval_ms?: number
  state_backend?: string
  max_restarts_on_worker_loss?: number
  alignment?: BarrierAlignment
  restore_from_dir?: string
  restore_from_checkpoint_id?: number
}

function text(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

// A non-negative integer, or undefined when the field is blank or malformed
// (the coordinator would refuse a negative or fractional value).
function count(v: number | undefined): number | undefined {
  return v != null && Number.isInteger(v) && v >= 0 ? v : undefined
}

// The options with blanks dropped and malformed numbers removed.
export function normaliseRecovery(o?: RecoveryOptions): RecoveryOptions {
  if (!o) return {}
  const out: RecoveryOptions = {}
  const dir = text(o.checkpoint_dir)
  if (dir) out.checkpoint_dir = dir
  const interval = count(o.checkpoint_interval_ms)
  if (interval != null) out.checkpoint_interval_ms = interval
  const backend = text(o.state_backend)
  if (backend) out.state_backend = backend
  const restarts = count(o.max_restarts_on_worker_loss)
  if (restarts != null) out.max_restarts_on_worker_loss = restarts
  if (o.alignment && BARRIER_ALIGNMENTS.includes(o.alignment)) out.alignment = o.alignment
  const restoreDir = text(o.restore_from_dir)
  if (restoreDir) out.restore_from_dir = restoreDir
  const restoreId = count(o.restore_from_checkpoint_id)
  if (restoreId != null) out.restore_from_checkpoint_id = restoreId
  return out
}

export function hasRecoveryOptions(o?: RecoveryOptions): boolean {
  return Object.keys(normaliseRecovery(o)).length > 0
}

// Appends the normalised options to `params` under the parameter names the
// coordinator reads.
export function appendRecoveryParams(
  params: URLSearchParams,
  o?: RecoveryOptions,
): URLSearchParams {
  const n = normaliseRecovery(o)
  if (n.checkpoint_dir) params.set('checkpoint_dir', n.checkpoint_dir)
  if (n.checkpoint_interval_ms != null) {
    params.set('checkpoint_interval_ms', String(n.checkpoint_interval_ms))
  }
  if (n.state_backend) params.set('state_backend', n.state_backend)
  if (n.max_restarts_on_worker_loss != null) {
    params.set('max_restarts_on_worker_loss', String(n.max_restarts_on_worker_loss))
  }
  if (n.alignment) params.set('alignment', n.alignment)
  if (n.restore_from_dir) params.set('restore_from_dir', n.restore_from_dir)
  if (n.restore_from_checkpoint_id != null) {
    params.set('restore_from_checkpoint_id', String(n.restore_from_checkpoint_id))
  }
  return params
}

// One line for a collapsed options panel or a toast description.
export function describeRecovery(o?: RecoveryOptions): string {
  const n = normaliseRecovery(o)
  if (!n.checkpoint_dir) {
    return 'No checkpointing: the job will carry no recovery guarantee.'
  }
  const parts = [
    n.checkpoint_interval_ms != null
      ? `checkpoint every ${fmtInterval(n.checkpoint_interval_ms)} to ${n.checkpoint_dir}`
      : `checkpoint to ${n.checkpoint_dir} at the coordinator's default interval`,
  ]
  if (n.state_backend) parts.push(`state in ${n.state_backend}`)
  if (n.max_restarts_on_worker_loss != null) {
    parts.push(
      `${n.max_restarts_on_worker_loss} restart${n.max_restarts_on_worker_loss === 1 ? '' : 's'} on worker loss`,
    )
  }
  if (n.alignment) parts.push(`${n.alignment} barriers`)
  if (n.restore_from_dir) {
    parts.push(
      n.restore_from_checkpoint_id != null
        ? `restore checkpoint ${n.restore_from_checkpoint_id} from ${n.restore_from_dir}`
        : `restore from ${n.restore_from_dir}`,
    )
  }
  return parts.join(', ')
}

function fmtInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  return Number.isInteger(s) ? `${s}s` : `${s.toFixed(1)}s`
}
