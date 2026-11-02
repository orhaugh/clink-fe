import { describe, expect, it } from 'vitest'
import { GENERIC_ROLE_HINT, GENERIC_SUBTASK_ROLE, roleHint, roleLabel } from './roles'

describe('roleLabel', () => {
  it('shows the generic subtask role as what it runs, not its internal name', () => {
    expect(roleLabel(GENERIC_SUBTASK_ROLE)).toBe('operator chain')
    expect(roleHint(GENERIC_SUBTASK_ROLE)).toBe(GENERIC_ROLE_HINT)
  })

  it('leaves a role a job registered itself as it is', () => {
    expect(roleLabel('consumer')).toBe('consumer')
    expect(roleHint('consumer')).toBeUndefined()
  })
})
