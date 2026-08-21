import { describe, expect, it } from 'vitest'
import { applyCompositionOps } from '../../src/composition-ops.ts'

describe('applyCompositionOps', () => {
  it('applies nested edits without mutating the source value', () => {
    const source = { nested: { enabled: false }, tags: ['old'] }
    const next = applyCompositionOps(source, [
      { op: 'set', path: ['nested', 'enabled'], value: true },
      { op: 'set', path: ['tags', '1'], value: 'new' },
    ])
    expect(next).toEqual({ nested: { enabled: true }, tags: ['old', 'new'] })
    expect(source).toEqual({ nested: { enabled: false }, tags: ['old'] })
  })

  it('supports unset operations and an empty path reset', () => {
    const source = { keep: true, remove: 'value', nested: { remove: 1 } }
    expect(applyCompositionOps(source, [
      { op: 'unset', path: ['nested', 'remove'] },
      { op: 'unset', path: ['remove'] },
    ])).toEqual({ keep: true, nested: {} })
    expect(applyCompositionOps(source, [{ op: 'unset', path: [] }])).toBeUndefined()
  })

  it('materializes missing object and array containers', () => {
    expect(applyCompositionOps({}, [{ op: 'set', path: ['fresh', 'value'], value: 1 }]))
      .toEqual({ fresh: { value: 1 } })
    expect(applyCompositionOps({ items: [] }, [{ op: 'set', path: ['items', '0', 'id'], value: 'x' }]))
      .toEqual({ items: [{ id: 'x' }] })
  })
})
