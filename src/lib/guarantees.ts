// Presentation of clink's delivery-guarantee vocabularies.
//
// Two vocabularies exist and must not be confused:
//
// - the END-TO-END level the coordinator's analyser computes for a JOB at
//   submit (connectors::EndToEndGuarantee, on JobSummary.delivery_guarantee),
//   the weakest link across source, checkpointing and sinks, and the only
//   value that says what a running job actually promises;
// - the per-CONNECTOR level one capability record declares for a source or
//   sink variant (connectors::DeliveryGuarantee, on ConnectorVariant.delivery),
//   which says what that connector CAN provide when the rest of the pipeline
//   lets it.
//
// Both are strings on the wire so a level this console does not know still
// renders (muted, with the raw name) rather than disappearing.

export type Tone = 'ok' | 'info' | 'warn' | 'danger' | 'muted'

export interface GuaranteeView {
  // Short badge text.
  short: string
  // One line of explanation for a tooltip or a detail card.
  label: string
  tone: Tone
}

const JOB_LEVELS: Record<string, GuaranteeView> = {
  END_TO_END_EXACTLY_ONCE: {
    short: 'exactly-once',
    label:
      'Exactly-once end to end: a replayable source, checkpointed state and output that commits or publishes with the checkpoint.',
    tone: 'ok',
  },
  EFFECTIVELY_ONCE_REQUIRES_IDEMPOTENT_KEY: {
    short: 'effectively-once',
    label:
      'Effectively once: replayed output collapses on a keyed upsert, which is correct only if the configured key identifies a row (clink cannot verify that).',
    tone: 'info',
  },
  STATE_EXACTLY_ONCE_OUTPUT_AT_LEAST_ONCE: {
    short: 'at-least-once output',
    label:
      'State is exactly-once but the output path is not transactional, so a restart can repeat output.',
    tone: 'warn',
  },
  AT_LEAST_ONCE_SOURCE: {
    short: 'at-least-once source',
    label:
      'Nothing is lost, but the source keeps no position of its own: its broker delivers again whatever was not acknowledged at a checkpoint, so records can enter the job twice and state and output are at least once.',
    tone: 'warn',
  },
  AT_MOST_ONCE_SOURCE: {
    short: 'at-most-once',
    label:
      'The source cannot replay from a recorded position, so records in flight at a failure are lost.',
    tone: 'danger',
  },
  NO_RECOVERY_GUARANTEE: {
    short: 'no recovery',
    label:
      'Checkpointing is off: no completed checkpoint can exist, so nothing bounds what a failure loses or repeats.',
    tone: 'warn',
  },
}

function unknownLevel(level: string): GuaranteeView {
  return { short: level.toLowerCase().replace(/_/g, ' '), label: level, tone: 'muted' }
}

// The job-level verdict. null when the coordinator reported none (an older
// coordinator), so callers can render a dash rather than a wrong badge.
export function describeJobGuarantee(level: string | undefined | null): GuaranteeView | null {
  if (!level) return null
  return JOB_LEVELS[level] ?? unknownLevel(level)
}

const CONNECTOR_LEVELS: Record<string, GuaranteeView> = {
  exactly_once_two_phase_commit: {
    short: 'exactly-once (2PC)',
    label:
      'Output is staged in an external transaction prepared at the barrier and committed when the checkpoint completes.',
    tone: 'ok',
  },
  exactly_once_atomic_publish: {
    short: 'exactly-once (atomic publish)',
    label:
      'Output becomes visible in one atomic publication tied to checkpoint completion: a rename, a manifest swap, a multipart complete.',
    tone: 'ok',
  },
  effectively_once_idempotent: {
    short: 'effectively-once',
    label:
      'Writes are keyed upserts, so duplicates collapse in the external system when the key identifies a row.',
    tone: 'info',
  },
  at_least_once: {
    short: 'at-least-once',
    label: 'No loss; duplicates are possible after a restart.',
    tone: 'warn',
  },
  at_most_once: {
    short: 'at-most-once',
    label: 'Records can be lost on failure.',
    tone: 'danger',
  },
  no_durable_restart_guarantee: {
    short: 'no restart guarantee',
    label:
      'Keeps no position and joins no checkpoint, so a restart has no defined relationship to what was already processed.',
    tone: 'muted',
  },
}

// Ordering for "how strong is this", mirroring connectors::strength(): the
// two exactly-once mechanisms tie at the top and effectively-once sits below
// them because it depends on a key clink cannot verify.
const CONNECTOR_STRENGTH: Record<string, number> = {
  no_durable_restart_guarantee: 0,
  at_most_once: 1,
  at_least_once: 2,
  effectively_once_idempotent: 3,
  exactly_once_atomic_publish: 4,
  exactly_once_two_phase_commit: 4,
}

// The per-connector declaration. null when absent.
export function describeConnectorDelivery(level: string | undefined | null): GuaranteeView | null {
  if (!level) return null
  return CONNECTOR_LEVELS[level] ?? unknownLevel(level)
}

export function connectorStrength(level: string | undefined | null): number {
  return (level && CONNECTOR_STRENGTH[level]) || 0
}

export function isExactlyOnceDelivery(level: string | undefined | null): boolean {
  return connectorStrength(level) >= 4
}
