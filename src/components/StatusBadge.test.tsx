import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  DeliveryBadge,
  GuaranteeBadge,
  JobStateBadge,
  LogLevelBadge,
  SubtaskStatusBadge,
  WorkerStateBadge,
} from './StatusBadge'
import type { JobState } from '@/lib/types'

describe('JobStateBadge', () => {
  it.each<[JobState, string]>([
    ['running', 'Running'],
    ['completed', 'Completed'],
    ['failed', 'Failed'],
    ['cancelled', 'Cancelled'],
  ])('renders the %s state as "%s"', (state, label) => {
    render(<JobStateBadge state={state} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})

describe('WorkerStateBadge', () => {
  it('shows Live when not lost and Lost when lost', () => {
    const { rerender } = render(<WorkerStateBadge lost={false} />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    rerender(<WorkerStateBadge lost={true} />)
    expect(screen.getByText('Lost')).toBeInTheDocument()
  })
})

describe('SubtaskStatusBadge', () => {
  it('renders the raw status string', () => {
    render(<SubtaskStatusBadge status="ready" />)
    expect(screen.getByText('ready')).toBeInTheDocument()
  })
})

describe('LogLevelBadge', () => {
  it('renders the level text', () => {
    render(<LogLevelBadge level="error" />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})

describe('GuaranteeBadge', () => {
  it('renders the short level with the limiting factor in the tooltip', () => {
    render(
      <GuaranteeBadge
        level="STATE_EXACTLY_ONCE_OUTPUT_AT_LEAST_ONCE"
        limitingFactor="sink 'file_text_sink'"
      />,
    )
    const badge = screen.getByText('at-least-once output')
    expect(badge).toHaveAttribute(
      'title',
      expect.stringContaining("Limited by sink 'file_text_sink'"),
    )
  })

  it('renders a dash when the coordinator reported no level', () => {
    render(<GuaranteeBadge level={undefined} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('omits the limiting clause when nothing limits the level', () => {
    render(<GuaranteeBadge level="END_TO_END_EXACTLY_ONCE" limitingFactor="" />)
    expect(screen.getByText('exactly-once')).not.toHaveAttribute(
      'title',
      expect.stringContaining('Limited by'),
    )
  })
})

describe('DeliveryBadge', () => {
  it('renders a connector delivery level and a dash when absent', () => {
    const { rerender } = render(<DeliveryBadge level="exactly_once_two_phase_commit" />)
    expect(screen.getByText('exactly-once (2PC)')).toBeInTheDocument()
    rerender(<DeliveryBadge level={undefined} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
