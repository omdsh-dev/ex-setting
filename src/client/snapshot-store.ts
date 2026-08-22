/**
 * Minimal writable snapshot store conforming to the registry runtime's
 * published `SnapshotStore` contract (type-only import — the runtime's
 * factory ships inside its closure-factory /client bundle, which source
 * modules cannot value-import; the contract keeps source imports type-only
 * and builds state through local interfaces).
 */

import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Create a local snapshot store over the runtime's contract shape.
 * @param init - initial state.
 * @returns a store with getSnapshot/subscribe/set/update; update drafts
 * through a structured clone (the catalog mutations only assign top-level
 * fields).
 */
export function createSnapshotStore<T>(init: T): SnapshotStore<T> {
  let state: T = init
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next) {
      state = next
      for (const listener of [...listeners]) listener()
    },
    update(mutator) {
      const draft = structuredClone(state)
      mutator(draft)
      state = draft
      for (const listener of [...listeners]) listener()
    },
  }
}
