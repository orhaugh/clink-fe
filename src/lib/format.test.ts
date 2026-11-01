import { describe, it, expect } from 'vitest'
import { fmtCount, fmtRate } from './format'

describe('fmtRate', () => {
  it.each([
    [461.6146982880302, '462'],
    [17.16549295774648, '17'],
    [7.97461703904, '8.0'],
    [0.4, '0.4'],
    [0, '0'],
    [19_734.2, '19.7k'],
    [2_450_000, '2.45M'],
  ])('%s/s renders as %s', (perSec, text) => {
    expect(fmtRate(perSec)).toBe(text)
  })

  it('renders a missing or non-finite rate as a dash', () => {
    expect(fmtRate(undefined)).toBe('-')
    expect(fmtRate(Number.NaN)).toBe('-')
    expect(fmtRate(Number.POSITIVE_INFINITY)).toBe('-')
  })
})

describe('fmtCount', () => {
  it('abbreviates thousands and millions', () => {
    expect(fmtCount(999)).toBe('999')
    expect(fmtCount(1_634_719)).toBe('1.63M')
    expect(fmtCount(undefined)).toBe('-')
  })
})
