/**
 * Controller for the automatically crawled plugin-settings catalog. The host
 * remains the source of truth: the store keeps the latest redacted settings
 * namespaces and composition rows, with latest-load-wins refresh semantics.
 */

import type {
  CompositionNamespaceView, IApiClient, SettingsNamespaceView,
} from '@deepseek-ai/dsh-client-connection/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Generic plugin-settings catalog snapshot. */
export interface PluginSettingsState {
  /** Current request status. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Whole-load failure text. */
  error: string | null
  /** Whether the host settings provider accepts writes. */
  writable: boolean
  /** Settings namespaces the host serves, ordered by namespace id. */
  namespaces: readonly SettingsNamespaceView[]
  /** Mounted plugins' composition configurations, ordered by row id. */
  composition: readonly CompositionNamespaceView[]
}

/** Stable key of one settings-dialog plugin entry. */
export type PluginSettingsEntryKey = `settings:${string}` | `composition:${string}`

/** One automatically crawled settings-dialog entry. */
export type PluginSettingsEntry =
  | {
    kind: 'settings'
    key: PluginSettingsEntryKey
    label: string
    namespace: SettingsNamespaceView
  }
  | {
    kind: 'composition'
    key: PluginSettingsEntryKey
    label: string
    row: CompositionNamespaceView
  }

/**
 * Project the two crawler domains into stable settings-dialog entries.
 * @param state - current crawler snapshot.
 * @returns settings entries followed by composition entries; sources stay distinct and label collisions fall back to row ids.
 */
export function pluginSettingsEntries(state: PluginSettingsState): PluginSettingsEntry[] {
  const settings = state.namespaces.map(namespace => ({
    kind: 'settings' as const,
    key: `settings:${namespace.ns}` as const,
    label: namespace.ns,
    namespace,
  }))
  const occupiedLabels = new Set(settings.map(entry => entry.label))
  const composition = state.composition.map((row) => {
    const preferredLabel = row.name ?? row.id
    let label = preferredLabel
    if (occupiedLabels.has(label)) {
      label = occupiedLabels.has(row.id) ? `${row.id} · Config` : row.id
    }
    occupiedLabels.add(preferredLabel)
    occupiedLabels.add(label)
    return {
      kind: 'composition' as const,
      key: `composition:${row.id}` as const,
      label,
      row,
    }
  })
  return [...settings, ...composition]
}

/**
 * Resolve one dynamic navigation key against the latest crawler snapshot.
 * @param state - current crawler snapshot.
 * @param key - registration-bound entry key.
 * @returns the matching entry, or undefined after that source disappears.
 */
export function pluginSettingsEntry(
  state: PluginSettingsState,
  key: PluginSettingsEntryKey,
): PluginSettingsEntry | undefined {
  return pluginSettingsEntries(state).find(entry => entry.key === key)
}

/**
 * Normalize a rejected wire call or arbitrary thrown value for user-visible copy.
 * @param error - rejected value to normalize.
 * @returns its Error message or string coercion.
 */
export function settingsMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Catalog controller; one instance belongs to one settings composition. */
export class PluginSettingsStore {
  /** uSES-compatible catalog snapshot. */
  readonly store: SnapshotStore<PluginSettingsState> = createSnapshotStore<PluginSettingsState>({
    status: 'idle',
    error: null,
    writable: false,
    namespaces: [],
    composition: [],
  })

  private generation = 0

  /**
   * @param api - the settings and composition wire faces.
   */
  constructor(private readonly api: Pick<IApiClient, 'settings' | 'composition'>) {}

  /**
   * Load the redacted descriptors the host serves, ordered by namespace id.
   * Latest-load-wins prevents an older reconnect or invalidation response
   * from replacing newer data.
   * @returns once the snapshot has been committed.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    try {
      const [settingsResponse, compositionResponse] = await Promise.all([
        this.api.settings.describe({}),
        this.api.composition.describe({}),
      ])
      if (!settingsResponse.result.ok) throw new Error(settingsResponse.result.error.message)
      if (!compositionResponse.result.ok) throw new Error(compositionResponse.result.error.message)
      const { writable, namespaces: described } = settingsResponse.result.value
      const namespaces = [...described].sort((a, b) => a.ns.localeCompare(b.ns))
      const composition = [...compositionResponse.result.value.namespaces]
        .sort((a, b) => a.id.localeCompare(b.id))
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'ready'
        state.error = null
        state.writable = writable
        state.namespaces = namespaces
        state.composition = composition
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((state) => {
        state.status = 'error'
        state.error = settingsMessage(error)
      })
    }
  }
}
