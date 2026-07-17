import { describe, it, expect } from 'vitest'
import {
  parsePrometheus,
  toView,
  familyTotal,
  byLabel,
  scalar,
  sampleTotal,
  avgFromSumCount,
} from './prometheus'

describe('parsePrometheus', () => {
  it('parses a bare unlabelled sample', () => {
    const fams = parsePrometheus('clink_up 1')
    expect(fams).toHaveLength(1)
    expect(fams[0]).toMatchObject({ name: 'clink_up' })
    expect(fams[0].samples[0]).toEqual({ name: 'clink_up', labels: {}, value: 1 })
  })

  it('captures HELP and TYPE comment lines', () => {
    const text = ['# HELP clink_jobs_running jobs currently running', '# TYPE clink_jobs_running gauge', 'clink_jobs_running 3'].join('\n')
    const [f] = parsePrometheus(text)
    expect(f.help).toBe('jobs currently running')
    expect(f.type).toBe('gauge')
    expect(f.samples[0].value).toBe(3)
  })

  it('parses labels including commas and escaped quotes inside values', () => {
    const [f] = parsePrometheus('clink_op{op_id="5",name="a,b \\"q\\""} 42')
    expect(f.samples[0].labels).toEqual({ op_id: '5', name: 'a,b "q"' })
    expect(f.samples[0].value).toBe(42)
  })

  it('strips _sum/_count/_bucket suffixes for family grouping but keeps full sample names', () => {
    const text = ['clink_lat_ms_sum 100', 'clink_lat_ms_count 4', 'clink_lat_ms_bucket{le="10"} 2'].join('\n')
    const fams = parsePrometheus(text)
    expect(fams).toHaveLength(1)
    expect(fams[0].name).toBe('clink_lat_ms')
    expect(fams[0].samples.map((s) => s.name).sort()).toEqual(['clink_lat_ms_bucket', 'clink_lat_ms_count', 'clink_lat_ms_sum'])
  })

  it('ignores an optional trailing timestamp column', () => {
    const [f] = parsePrometheus('clink_up 1 1699999999000')
    expect(f.samples[0].value).toBe(1)
  })

  it('skips blank lines, malformed lines, and NaN values', () => {
    const text = ['', '   ', 'not a metric line at all', 'clink_bad NaN', 'clink_ok 7'].join('\n')
    const fams = parsePrometheus(text)
    expect(fams.map((f) => f.name)).toEqual(['clink_ok'])
  })

  it('parses floating point and scientific-notation values', () => {
    const fams = parsePrometheus(['clink_ratio 0.25', 'clink_big 1.5e3'].join('\n'))
    expect(scalar(toView('clink_ratio 0.25'), 'clink_ratio')).toBe(0.25)
    expect(fams.find((f) => f.name === 'clink_big')!.samples[0].value).toBe(1500)
  })

  it('returns families sorted by name', () => {
    const fams = parsePrometheus(['z_metric 1', 'a_metric 2', 'm_metric 3'].join('\n'))
    expect(fams.map((f) => f.name)).toEqual(['a_metric', 'm_metric', 'z_metric'])
  })

  it('groups multiple label sets under one family', () => {
    const text = ['clink_disk{volume="workdir"} 10', 'clink_disk{volume="ckpt"} 20'].join('\n')
    const [f] = parsePrometheus(text)
    expect(f.samples).toHaveLength(2)
  })

  it('returns empty for empty input', () => {
    expect(parsePrometheus('')).toEqual([])
  })
})

describe('metrics view helpers', () => {
  const text = [
    '# TYPE clink_jobs_running gauge',
    'clink_jobs_running 5',
    'clink_disk_used{volume="workdir"} 100',
    'clink_disk_used{volume="ckpt"} 250',
    'clink_lat_ms_sum 900',
    'clink_lat_ms_count 3',
  ].join('\n')
  const v = toView(text)

  it('toView indexes families by name', () => {
    expect(v.byName.get('clink_jobs_running')?.type).toBe('gauge')
    expect(v.families.length).toBe(3)
  })

  it('familyTotal sums all samples in a family', () => {
    expect(familyTotal(v, 'clink_disk_used')).toBe(350)
    expect(familyTotal(v, 'clink_jobs_running')).toBe(5)
  })

  it('familyTotal returns undefined for an unknown family', () => {
    expect(familyTotal(v, 'nope')).toBeUndefined()
  })

  it('byLabel breaks samples out by a label, defaulting missing labels to ""', () => {
    expect(byLabel(v, 'clink_disk_used', 'volume')).toEqual([
      { key: 'workdir', value: 100 },
      { key: 'ckpt', value: 250 },
    ])
    expect(byLabel(v, 'clink_jobs_running', 'volume')).toEqual([{ key: '', value: 5 }])
  })

  it('byLabel returns [] for an unknown family', () => {
    expect(byLabel(v, 'nope', 'volume')).toEqual([])
  })

  it('scalar returns the first sample value, undefined when absent', () => {
    expect(scalar(v, 'clink_jobs_running')).toBe(5)
    expect(scalar(v, 'nope')).toBeUndefined()
  })

  it('sampleTotal sums a specific fully-qualified sample name', () => {
    expect(sampleTotal(v, 'clink_lat_ms_sum')).toBe(900)
    expect(sampleTotal(v, 'clink_lat_ms_count')).toBe(3)
    expect(sampleTotal(v, 'clink_lat_ms_bucket')).toBeUndefined()
    expect(sampleTotal(v, 'nope_sum')).toBeUndefined()
  })

  it('avgFromSumCount derives sum/count, undefined when count is zero or missing', () => {
    expect(avgFromSumCount(v, 'clink_lat_ms')).toBe(300)
    expect(avgFromSumCount(toView('clink_x_sum 5\nclink_x_count 0'), 'clink_x')).toBeUndefined()
    expect(avgFromSumCount(toView('clink_x_count 5'), 'clink_x')).toBeUndefined()
  })
})
