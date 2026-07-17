import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { JobStateBadge, WorkerStateBadge, SubtaskStatusBadge, LogLevelBadge } from './StatusBadge'
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
