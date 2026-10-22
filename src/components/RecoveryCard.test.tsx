import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecoveryCard } from './RecoveryCard'
import type { JobDetail } from '@/lib/types'

const base: JobDetail = {
  id: 4,
  expected_completion: 2,
  completed_count: 0,
  completion_signalled: false,
  cancel_requested: false,
  errors: [],
  subtask_errors: [],
  tasks: [],
  latest_completed_checkpoint_id: 0,
  pending_checkpoint_ids: [],
}

describe('RecoveryCard', () => {
  it('says what an older coordinator does not report instead of inventing it', () => {
    render(<RecoveryCard job={base} />)
    expect(screen.getByText(/does not report the job's delivery guarantee/)).toBeInTheDocument()
    expect(screen.getByText(/does not report the checkpoint configuration/)).toBeInTheDocument()
  })

  it('shows the guarantee, its limit, the warnings and the running configuration', () => {
    render(
      <RecoveryCard
        job={{
          ...base,
          checkpoint_dir: '/ckpt',
          checkpoint_interval_ms: 10_000,
          state_backend_uri: 'rocksdb:///state',
          restore_from_dir: '',
          restore_from_checkpoint_id: 0,
          max_restarts_on_worker_loss: 3,
          unaligned_checkpoints: false,
          adaptive_barrier_mode: true,
          latest_completed_checkpoint_id: 12,
          pending_checkpoint_ids: [13],
          delivery_guarantee: 'STATE_EXACTLY_ONCE_OUTPUT_AT_LEAST_ONCE',
          guarantee_limiting_factor: "sink 'file_text_sink'",
          guarantee_reasons: ['source kafka: replayable', "sink 'file_text_sink': at_least_once"],
          guarantee_warnings: ['a warning'],
        }}
      />,
    )
    expect(screen.getByText('at-least-once output')).toBeInTheDocument()
    expect(screen.getByText("sink 'file_text_sink'")).toBeInTheDocument()
    expect(screen.getByText('a warning')).toBeInTheDocument()
    expect(screen.getByText('on')).toBeInTheDocument()
    expect(screen.getByText('/ckpt')).toBeInTheDocument()
    expect(screen.getByText('10.0s')).toBeInTheDocument()
    expect(screen.getByText('rocksdb:///state')).toBeInTheDocument()
    expect(screen.getByText(/adaptive/)).toBeInTheDocument()
    expect(screen.getByText('fresh start')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText(/How the analyser reached this level \(2\)/)).toBeInTheDocument()
  })

  it('flags a job that is not checkpointing', () => {
    render(
      <RecoveryCard
        job={{
          ...base,
          checkpoint_dir: '',
          checkpoint_interval_ms: 0,
          state_backend_uri: '',
          delivery_guarantee: 'NO_RECOVERY_GUARANTEE',
          guarantee_limiting_factor: 'checkpointing disabled',
        }}
      />,
    )
    expect(screen.getByText('no recovery')).toBeInTheDocument()
    expect(screen.getByText('off (no checkpoint directory)')).toBeInTheDocument()
    expect(screen.getByText('coordinator default')).toBeInTheDocument()
  })
})
