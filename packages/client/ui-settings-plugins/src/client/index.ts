/**
 * Browser half of the automatic plugin-configuration UI. Crawled settings
 * namespaces and composition Config rows become source-distinct first-level
 * settings.section entries; authors register nothing client-side.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the shell's settings.section SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ctx.locale and the renderer's locale seat.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  createPluginSettingsSection, PluginSettingsStatusSection,
} from './PluginSettingsSection.tsx'
import type { PluginSettingsSectionInjected } from './PluginSettingsSection.tsx'
import {
  PluginSettingsStore, pluginSettingsEntries,
} from './plugin-settings-store.ts'
import type {
  PluginSettingsEntryKey, PluginSettingsState,
} from './plugin-settings-store.ts'
import { en, zh, type SettingsKey } from './locales.ts'

export type {
  PluginSettingsSectionCommonProps, PluginSettingsSectionInjected,
  PluginSettingsSectionProps,
} from './PluginSettingsSection.tsx'
export type {
  PluginSettingsEntry, PluginSettingsEntryKey, PluginSettingsState,
} from './plugin-settings-store.ts'
export type { SettingsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Automatic plugin-configuration editor copy. */
    'settings-plugins': SettingsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'settings-plugins'
/** Navigation order shared by all automatically crawled entries. */
const PLUGIN_ORDER = 20
/** Stable id of the temporary loading, empty, or initial-error row. */
const STATUS_ID = 'plugin:status'

type StatusPhase = 'loading' | 'empty' | 'error'

type DesiredSection =
  | {
    kind: 'plugin'
    id: string
    signature: string
    label: string
    pluginKey: PluginSettingsEntryKey
  }
  | {
    kind: 'status'
    id: typeof STATUS_ID
    signature: string
    labelKey: `status.${StatusPhase}Nav`
  }

type LiveSection = {
  signature: string
  dispose: () => void
}

/** Project the catalog snapshot into dynamic settings.section registrations. */
function desiredSections(state: PluginSettingsState): DesiredSection[] {
  const entries = pluginSettingsEntries(state)
  if (entries.length > 0) {
    return entries.map(entry => ({
      kind: 'plugin',
      id: `plugin:${entry.key}`,
      signature: `${entry.key}\u0000${entry.label}`,
      label: entry.label,
      pluginKey: entry.key,
    }))
  }
  const phase: StatusPhase = state.status === 'error'
    ? 'error'
    : state.status === 'ready' ? 'empty' : 'loading'
  return [{
    kind: 'status',
    id: STATUS_ID,
    signature: `status:${phase}`,
    labelKey: `status.${phase}Nav`,
  }]
}

/**
 * Required services. settings.section is declaration-ordered independently,
 * so each dynamic contribution uses declaration-aware deferral.
 */
export const inject = ['slots', 'locale', 'connection']

/**
 * Load the crawler catalog, reconcile source-distinct first-level navigation,
 * and keep the catalog fresh on host invalidations.
 * @param ctx - client root context.
 * @returns once the initial catalog has settled into plugin or status entries.
 */
export async function apply(ctx: ClientContext): Promise<void> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-plugins: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new PluginSettingsStore(connection.api)
  const reload = (): Promise<void> => controller.load()
  const mutateSettings: PluginSettingsSectionInjected['mutateSettings'] =
    (request, signal) => connection.api.settings.mutate(request, signal)
  const updateComposition: PluginSettingsSectionInjected['updateComposition'] =
    (request, signal) => connection.api.composition.update(request, signal)
  const removeComposition: PluginSettingsSectionInjected['removeComposition'] =
    (request, signal) => connection.api.composition.remove(request, signal)
  const injected = (): PluginSettingsSectionInjected => ({
    hooks: { pluginSettings: controller.store },
    reload,
    mutateSettings,
    updateComposition,
    removeComposition,
  })
  const t = ctx.locale.bind(NS)

  ctx.effect(() => {
    const live = new Map<string, LiveSection>()
    const reconcile = (): void => {
      const desired = desiredSections(controller.store.getSnapshot())
      const next = new Map(desired.map(section => [section.id, section]))
      for (const [id, current] of live) {
        if (next.get(id)?.signature === current.signature) continue
        current.dispose()
        live.delete(id)
      }
      for (const section of desired) {
        if (live.has(section.id)) continue
        const component = section.kind === 'plugin'
          ? createPluginSettingsSection(section.pluginKey)
          : PluginSettingsStatusSection
        const label = section.kind === 'plugin'
          ? section.label
          : () => t(section.labelKey)
        const dispose = ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: section.id,
          order: PLUGIN_ORDER,
          label,
          locale: NS,
          inject: injected,
        }, component))
        live.set(section.id, { signature: section.signature, dispose })
      }
    }
    const unsubscribe = controller.store.subscribe(reconcile)
    reconcile()
    return () => {
      unsubscribe()
      for (const section of live.values()) section.dispose()
      live.clear()
    }
  }, 'ui-settings-plugins: dynamic settings sections')

  const initial = { loading: true }
  const pendingInitialLoads = new Set<Promise<void>>()
  const trackInitialLoad = (): void => {
    const load = controller.load()
    pendingInitialLoads.add(load)
    const release = (): void => { pendingInitialLoads.delete(load) }
    void load.then(release, release)
  }
  ctx.effect(() => {
    const refresh = (): void => {
      if (initial.loading) trackInitialLoad()
      else void controller.load()
    }
    const disposers = [
      ctx.on('settings/changed', refresh),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-settings-plugins: pushed invalidations')

  trackInitialLoad()
  while (pendingInitialLoads.size > 0) {
    await Promise.all(pendingInitialLoads)
  }
  initial.loading = false
}
