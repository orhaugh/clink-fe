import { describe, it, expect } from 'vitest'
import {
  connectorStrength,
  describeConnectorDelivery,
  describeJobGuarantee,
  isExactlyOnceDelivery,
} from './guarantees'

describe('describeJobGuarantee', () => {
  it.each([
    ['END_TO_END_EXACTLY_ONCE', 'exactly-once', 'ok'],
    ['EFFECTIVELY_ONCE_REQUIRES_IDEMPOTENT_KEY', 'effectively-once', 'info'],
    ['STATE_EXACTLY_ONCE_OUTPUT_AT_LEAST_ONCE', 'at-least-once output', 'warn'],
    ['AT_MOST_ONCE_SOURCE', 'at-most-once', 'danger'],
    ['NO_RECOVERY_GUARANTEE', 'no recovery', 'warn'],
  ])('%s renders as "%s" (%s)', (level, short, tone) => {
    expect(describeJobGuarantee(level)).toMatchObject({ short, tone })
    expect(describeJobGuarantee(level)!.label.length).toBeGreaterThan(10)
  })

  it('is null when the coordinator reported no level', () => {
    expect(describeJobGuarantee(undefined)).toBeNull()
    expect(describeJobGuarantee(null)).toBeNull()
    expect(describeJobGuarantee('')).toBeNull()
  })

  it('still renders a level it does not know, muted, with the raw name', () => {
    expect(describeJobGuarantee('SOME_FUTURE_LEVEL')).toEqual({
      short: 'some future level',
      label: 'SOME_FUTURE_LEVEL',
      tone: 'muted',
    })
  })
})

describe('describeConnectorDelivery', () => {
  it.each([
    ['exactly_once_two_phase_commit', 'exactly-once (2PC)', 'ok'],
    ['exactly_once_atomic_publish', 'exactly-once (atomic publish)', 'ok'],
    ['effectively_once_idempotent', 'effectively-once', 'info'],
    ['at_least_once', 'at-least-once', 'warn'],
    ['at_most_once', 'at-most-once', 'danger'],
    ['no_durable_restart_guarantee', 'no restart guarantee', 'muted'],
  ])('%s renders as "%s" (%s)', (level, short, tone) => {
    expect(describeConnectorDelivery(level)).toMatchObject({ short, tone })
  })

  it('is null when absent and muted when unknown', () => {
    expect(describeConnectorDelivery(undefined)).toBeNull()
    expect(describeConnectorDelivery('')).toBeNull()
    expect(describeConnectorDelivery('teleport')).toMatchObject({
      short: 'teleport',
      tone: 'muted',
    })
  })
})

describe('connector strength', () => {
  it('orders the levels like the engine, with both exactly-once mechanisms on top', () => {
    expect(connectorStrength('exactly_once_two_phase_commit')).toBe(4)
    expect(connectorStrength('exactly_once_atomic_publish')).toBe(4)
    expect(connectorStrength('effectively_once_idempotent')).toBe(3)
    expect(connectorStrength('at_least_once')).toBe(2)
    expect(connectorStrength('at_most_once')).toBe(1)
    expect(connectorStrength('no_durable_restart_guarantee')).toBe(0)
  })

  it('treats absent and unknown levels as the weakest', () => {
    expect(connectorStrength(undefined)).toBe(0)
    expect(connectorStrength('')).toBe(0)
    expect(connectorStrength('teleport')).toBe(0)
  })

  it('isExactlyOnceDelivery is true only for the two exactly-once mechanisms', () => {
    expect(isExactlyOnceDelivery('exactly_once_two_phase_commit')).toBe(true)
    expect(isExactlyOnceDelivery('exactly_once_atomic_publish')).toBe(true)
    expect(isExactlyOnceDelivery('effectively_once_idempotent')).toBe(false)
    expect(isExactlyOnceDelivery(undefined)).toBe(false)
  })
})
