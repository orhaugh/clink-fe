import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecoveryOptionsFields } from './RecoveryOptions'

describe('RecoveryOptionsFields', () => {
  it('warns in the collapsed summary when no checkpoint directory is set', () => {
    render(<RecoveryOptionsFields value={{}} onChange={() => {}} idPrefix="t" />)
    expect(screen.getByText(/no recovery guarantee/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Checkpoint directory')).not.toBeInTheDocument()
  })

  it('summarises the configuration and expands to editable fields', () => {
    const onChange = vi.fn()
    render(
      <RecoveryOptionsFields
        value={{ checkpoint_dir: '/ckpt', checkpoint_interval_ms: 5000 }}
        onChange={onChange}
        idPrefix="t"
      />,
    )
    expect(screen.getByText('checkpoint every 5s to /ckpt')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.change(screen.getByLabelText('Max restarts on worker loss'), {
      target: { value: '3' },
    })
    expect(onChange).toHaveBeenLastCalledWith({
      checkpoint_dir: '/ckpt',
      checkpoint_interval_ms: 5000,
      max_restarts_on_worker_loss: 3,
    })
    fireEvent.change(screen.getByLabelText('Checkpoint interval (ms)'), { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({
      checkpoint_dir: '/ckpt',
      checkpoint_interval_ms: undefined,
    })
  })
})
