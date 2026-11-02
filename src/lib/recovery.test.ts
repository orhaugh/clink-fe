import { describe, it, expect } from 'vitest'
import {
  appendRecoveryParams,
  describeRecovery,
  describeRestarts,
  hasRecoveryOptions,
  normaliseRecovery,
} from './recovery'

describe('normaliseRecovery', () => {
  it('is empty for nothing, blanks and malformed numbers', () => {
    expect(normaliseRecovery()).toEqual({})
    expect(
      normaliseRecovery({
        checkpoint_dir: '  ',
        checkpoint_interval_ms: -1,
        state_backend: '',
        max_restarts_on_worker_loss: 1.5,
        restore_from_dir: '',
        restore_from_checkpoint_id: Number.NaN,
      }),
    ).toEqual({})
    expect(hasRecoveryOptions({ checkpoint_dir: ' ' })).toBe(false)
  })

  it('keeps every well-formed field and trims the paths', () => {
    expect(
      normaliseRecovery({
        checkpoint_dir: ' /ckpt ',
        checkpoint_interval_ms: 0,
        state_backend: 'rocksdb:///state',
        max_restarts_on_worker_loss: 3,
        alignment: 'adaptive',
        restore_from_dir: '/old',
        restore_from_checkpoint_id: 7,
      }),
    ).toEqual({
      checkpoint_dir: '/ckpt',
      checkpoint_interval_ms: 0,
      state_backend: 'rocksdb:///state',
      max_restarts_on_worker_loss: 3,
      alignment: 'adaptive',
      restore_from_dir: '/old',
      restore_from_checkpoint_id: 7,
    })
    expect(hasRecoveryOptions({ max_restarts_on_worker_loss: 0 })).toBe(true)
  })

  it('drops an alignment outside the coordinator vocabulary', () => {
    expect(normaliseRecovery({ alignment: 'sideways' as never })).toEqual({})
  })
})

describe('appendRecoveryParams', () => {
  it('adds nothing for empty options', () => {
    expect(appendRecoveryParams(new URLSearchParams({ mode: 'submit' })).toString()).toBe(
      'mode=submit',
    )
  })

  it('uses the coordinator parameter names and encodes URIs intact', () => {
    const p = appendRecoveryParams(new URLSearchParams(), {
      checkpoint_dir: '/var/lib/clink/ckpt',
      checkpoint_interval_ms: 5000,
      state_backend: 'remote-read:///state?hot_max_bytes=1',
      max_restarts_on_worker_loss: 2,
      alignment: 'unaligned',
      restore_from_dir: '/var/lib/clink/old',
      restore_from_checkpoint_id: 12,
    })
    expect(p.get('checkpoint_dir')).toBe('/var/lib/clink/ckpt')
    expect(p.get('checkpoint_interval_ms')).toBe('5000')
    expect(p.get('state_backend')).toBe('remote-read:///state?hot_max_bytes=1')
    expect(p.get('max_restarts_on_worker_loss')).toBe('2')
    expect(p.get('alignment')).toBe('unaligned')
    expect(p.get('restore_from_dir')).toBe('/var/lib/clink/old')
    expect(p.get('restore_from_checkpoint_id')).toBe('12')
    // The value survives percent-encoding so the backend query round-trips.
    expect(new URLSearchParams(p.toString()).get('state_backend')).toBe(
      'remote-read:///state?hot_max_bytes=1',
    )
  })
})

describe('describeRecovery', () => {
  it('names the consequence of no checkpoint directory', () => {
    expect(describeRecovery()).toMatch(/no recovery guarantee/i)
    expect(describeRecovery({ checkpoint_interval_ms: 1000 })).toMatch(/No checkpointing/)
  })

  it('summarises a full configuration in one line', () => {
    expect(
      describeRecovery({
        checkpoint_dir: '/ckpt',
        checkpoint_interval_ms: 10_000,
        state_backend: 'rocksdb:///s',
        max_restarts_on_worker_loss: 1,
        alignment: 'adaptive',
        restore_from_dir: '/old',
        restore_from_checkpoint_id: 4,
      }),
    ).toBe(
      'checkpoint every 10s to /ckpt, state in rocksdb:///s, 1 restart on worker loss, adaptive barriers, restore checkpoint 4 from /old',
    )
  })

  it('formats sub-second and fractional intervals, plural restarts and a bare restore dir', () => {
    expect(
      describeRecovery({
        checkpoint_dir: '/c',
        checkpoint_interval_ms: 500,
        restore_from_dir: '/o',
      }),
    ).toBe('checkpoint every 500ms to /c, restore from /o')
    expect(
      describeRecovery({
        checkpoint_dir: '/c',
        checkpoint_interval_ms: 1500,
        max_restarts_on_worker_loss: 3,
      }),
    ).toBe('checkpoint every 1.5s to /c, 3 restarts on worker loss')
  })

  it('says when the interval is the coordinator default', () => {
    expect(describeRecovery({ checkpoint_dir: '/c' })).toBe(
      "checkpoint to /c at the coordinator's default interval",
    )
  })
})

describe('describeRestarts', () => {
  it('marks a budget the default chose, and reads the raw sentinel an older coordinator sent', () => {
    expect(
      describeRestarts({ max_restarts_on_worker_loss: 10, max_restarts_on_worker_loss_auto: true }),
    ).toBe('10 (auto)')
    expect(
      describeRestarts({ max_restarts_on_worker_loss: 3, max_restarts_on_worker_loss_auto: false }),
    ).toBe('3')
    expect(describeRestarts({ max_restarts_on_worker_loss: 4_294_967_295 })).toBe('auto')
    expect(describeRestarts({})).toBe('-')
  })
})
