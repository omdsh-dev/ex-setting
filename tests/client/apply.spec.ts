/** Dynamic plugin-settings navigation: automatic catalog load, diffing, late declarations, HMR, and teardown. */
import { Context } from 'cordis'
import { describe, expect, it, vi } from 'vitest'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SlotsService } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleService } from '@deepseek-ai/dsh-client-locale/client'
import { usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { apply, inject } from '@deepseek-ai/dsh-ex-setting/client'
import type { PluginSettingsSectionInjected } from '../../src/client/PluginSettingsSection.tsx'

usePinnedBrowserLanguages('zh-CN')

const SEAT = 'settings.section'
const STATUS_ID = 'plugin:status'

type SettingsView = {
  ns: string
  schema: object
  value: object
  applies: 'live'
  secrets: never[]
  revision: number
}

type CompositionView = {
  id: string
  name?: string
  schema: object
  value: object
  secrets: never[]
}

function settingsView(ns: string, revision = 0): SettingsView {
  return { ns, schema: {}, value: {}, applies: 'live', secrets: [], revision }
}

function compositionView(id: string, name?: string): CompositionView {
  return { id, ...(name === undefined ? {} : { name }), schema: {}, value: {}, secrets: [] }
}

function settingsResponse(namespaces: SettingsView[]) {
  return {
    rpcId: 'settings-plugins' as never,
    result: { ok: true as const, value: { writable: true, namespaces } },
  }
}

function compositionResponse(namespaces: CompositionView[]) {
  return {
    rpcId: 'settings-plugins' as never,
    result: { ok: true as const, value: { namespaces } },
  }
}

async function bench(options: {
  settingsDescribe?: ReturnType<typeof vi.fn>
  compositionDescribe?: ReturnType<typeof vi.fn>
} = {}) {
  const ctx = new Context()
  await ctx.plugin(SlotsService).await()
  const locale = new LocaleService(ctx)
  ctx.provide('locale', locale)
  const settingsDescribe = options.settingsDescribe ?? vi.fn(() =>
    Promise.resolve(settingsResponse([settingsView('some-plugin')])))
  const compositionDescribe = options.compositionDescribe ?? vi.fn(() =>
    Promise.resolve(compositionResponse([])))
  const settingsMutate = vi.fn(() => Promise.resolve({
    rpcId: 'settings-plugins' as never,
    result: { ok: true as const, value: settingsView('some-plugin') },
  }))
  const compositionUpdate = vi.fn(() => Promise.resolve({
    rpcId: 'settings-plugins' as never,
    result: { ok: true as const, value: compositionView('session') },
  }))
  const compositionRemove = vi.fn(() => Promise.resolve({
    rpcId: 'settings-plugins' as never,
    result: { ok: true as const, value: {} },
  }))
  ctx.provide('connection', {
    api: {
      settings: { describe: settingsDescribe, mutate: settingsMutate },
      composition: {
        describe: compositionDescribe,
        update: compositionUpdate,
        remove: compositionRemove,
      },
    },
    isLoopback: true,
  } as never)
  return {
    ctx,
    slots: ctx.get('slots') as SlotsService,
    locale,
    settingsDescribe,
    compositionDescribe,
    settingsMutate,
    compositionUpdate,
    compositionRemove,
  }
}

/** Declare the shell's section slot the way ui-settings does. */
function declare(slots: SlotsService): () => void {
  return slots.register(
    {
      name: 'root',
      children: { [SEAT]: { kind: 'list', scope: 'root' } },
    } as never,
    () => null,
  )
}

function dynamicEntries(slots: SlotsService) {
  return slots.entries(SEAT).filter(entry => entry.options.id?.startsWith('plugin:') === true)
}

function dynamicIds(slots: SlotsService): Array<string | undefined> {
  return dynamicEntries(slots).map(entry => entry.options.id)
}

function dynamicEntry(slots: SlotsService, id: string) {
  return dynamicEntries(slots).find(entry => entry.options.id === id)
}

describe('ui-settings-plugins apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection'])
  })

  it('automatically registers one first-level entry per crawler source before or after declaration', async () => {
    const compositionDescribe = vi.fn(() => Promise.resolve(compositionResponse([
      compositionView('some-plugin', 'some-plugin'),
      compositionView('session', 'Session service'),
    ])))
    const before = await bench({ compositionDescribe })
    declare(before.slots)
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => {
      expect(dynamicIds(before.slots)).toEqual([
        'plugin:settings:some-plugin',
        'plugin:composition:session',
        'plugin:composition:some-plugin',
      ])
    })
    const settings = dynamicEntry(before.slots, 'plugin:settings:some-plugin')!
    const composition = dynamicEntry(before.slots, 'plugin:composition:session')!
    const sameIdComposition = dynamicEntry(before.slots, 'plugin:composition:some-plugin')!
    expect(settings.options).toMatchObject({ order: 20, label: 'some-plugin' })
    expect(composition.options).toMatchObject({ order: 20, label: 'Session service' })
    expect(sameIdComposition.options).toMatchObject({ order: 20, label: 'some-plugin · Config' })
    expect(new Set([settings.component, composition.component, sameIdComposition.component]).size).toBe(3)
    expect(settings.locale).toBe('settings-plugins')
    expect(before.slots.entries(SEAT).some(entry => entry.options.id === 'plugins')).toBe(false)
    const injected = (settings.inject as unknown as () => PluginSettingsSectionInjected)()
    expect(injected.hooks.pluginSettings.getSnapshot().status).toBe('ready')
    expect(typeof injected.reload).toBe('function')
    expect(typeof injected.mutateSettings).toBe('function')
    expect(typeof injected.updateComposition).toBe('function')
    expect(typeof injected.removeComposition).toBe('function')
    const signal = new AbortController().signal
    const settingsPayload = { ns: 'some-plugin', ops: [] }
    const compositionPayload = { id: 'session', ops: [] }
    const removePayload = { id: 'session' }
    await injected.mutateSettings(settingsPayload, signal)
    await injected.updateComposition(compositionPayload, signal)
    await injected.removeComposition(removePayload, signal)
    expect(before.settingsMutate).toHaveBeenCalledWith(settingsPayload, signal)
    expect(before.compositionUpdate).toHaveBeenCalledWith(compositionPayload, signal)
    expect(before.compositionRemove).toHaveBeenCalledWith(removePayload, signal)

    const after = await bench({ compositionDescribe })
    const fiber = after.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => { expect(after.settingsDescribe).toHaveBeenCalledOnce() })
    expect(after.slots.entries(SEAT)).toHaveLength(0)
    declare(after.slots)
    await vi.waitFor(() => {
      expect(dynamicIds(after.slots)).toEqual([
        'plugin:settings:some-plugin',
        'plugin:composition:session',
        'plugin:composition:some-plugin',
      ])
    })
  })

  it('uses one temporary row and replays invalidation received during initial loading', async () => {
    let settle!: (response: ReturnType<typeof settingsResponse>) => void
    const pending = new Promise<ReturnType<typeof settingsResponse>>((resolve) => { settle = resolve })
    const settingsDescribe = vi.fn()
      .mockImplementationOnce(() => pending)
      .mockResolvedValue(settingsResponse([]))
    const b = await bench({ settingsDescribe })
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await vi.waitFor(() => { expect(dynamicIds(b.slots)).toEqual([STATUS_ID]) })
    expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('正在加载插件设置')

    const loadingEntry = dynamicEntry(b.slots, STATUS_ID)
    expect(settingsDescribe).toHaveBeenCalledOnce()
    b.ctx.emit('connection/reset')
    expect(settingsDescribe).toHaveBeenCalledTimes(2)
    settle(settingsResponse([]))
    await fiber.await()
    await vi.waitFor(() => {
      expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('暂无插件设置')
    })
    expect(dynamicEntry(b.slots, STATUS_ID)).not.toBe(loadingEntry)
  })

  it('surfaces an initial failure in the temporary row and recovers on retry', async () => {
    const settingsDescribe = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(settingsResponse([]))
    const b = await bench({ settingsDescribe })
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => {
      expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('插件设置加载失败')
    })
    const injected = (dynamicEntry(b.slots, STATUS_ID)!.inject as unknown as () => PluginSettingsSectionInjected)()
    expect(injected.hooks.pluginSettings.getSnapshot()).toMatchObject({ status: 'error', error: 'offline' })
    await injected.reload()
    expect(settingsDescribe).toHaveBeenCalledTimes(2)
    expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('暂无插件设置')
  })

  it('diffs catalog membership while preserving unchanged entry identities and stale data on refresh failure', async () => {
    const wire: { namespaces: SettingsView[]; failure?: Error } = {
      namespaces: [settingsView('alpha'), settingsView('beta')],
    }
    const settingsDescribe = vi.fn(() => wire.failure === undefined
      ? Promise.resolve(settingsResponse(wire.namespaces))
      : Promise.reject(wire.failure))
    const b = await bench({ settingsDescribe })
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => {
      expect(dynamicIds(b.slots)).toEqual(['plugin:settings:alpha', 'plugin:settings:beta'])
    })
    const alpha = dynamicEntry(b.slots, 'plugin:settings:alpha')
    wire.namespaces = [settingsView('alpha', 1), settingsView('gamma')]
    b.ctx.emit('settings/changed', 'alpha')
    await vi.waitFor(() => {
      expect(dynamicIds(b.slots)).toEqual(['plugin:settings:alpha', 'plugin:settings:gamma'])
    })
    expect(dynamicEntry(b.slots, 'plugin:settings:alpha')).toBe(alpha)
    const injected = (alpha!.inject as unknown as () => PluginSettingsSectionInjected)()
    expect(injected.hooks.pluginSettings.getSnapshot().namespaces[0]?.revision).toBe(1)

    wire.failure = new Error('refresh failed')
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => {
      expect(injected.hooks.pluginSettings.getSnapshot().status).toBe('error')
    })
    expect(dynamicIds(b.slots)).toEqual(['plugin:settings:alpha', 'plugin:settings:gamma'])
    expect(dynamicEntry(b.slots, 'plugin:settings:alpha')).toBe(alpha)
    expect(settingsDescribe).toHaveBeenCalledTimes(3)
  })

  it('re-registers a composition entry whose unique display name changes', async () => {
    let rows = [compositionView('session', 'Session')]
    const compositionDescribe = vi.fn(() => Promise.resolve(compositionResponse(rows)))
    const b = await bench({
      settingsDescribe: vi.fn(() => Promise.resolve(settingsResponse([]))),
      compositionDescribe,
    })
    declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => { expect(dynamicIds(b.slots)).toEqual(['plugin:composition:session']) })
    const previous = dynamicEntry(b.slots, 'plugin:composition:session')
    rows = [compositionView('session', 'Sessions')]
    b.ctx.emit('connection/reset')
    await vi.waitFor(() => {
      expect(dynamicEntry(b.slots, 'plugin:composition:session')?.options.label).toBe('Sessions')
    })
    expect(dynamicEntry(b.slots, 'plugin:composition:session')).not.toBe(previous)
  })

  it('status labels follow locale without ledger churn and dictionaries are released on teardown', async () => {
    const b = await bench({ settingsDescribe: vi.fn(() => Promise.resolve(settingsResponse([]))) })
    declare(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => {
      expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('暂无插件设置')
    })
    const version = b.slots.getVersion(SEAT)
    b.locale.setLocale('en')
    expect(resolveSlotLabel(dynamicEntry(b.slots, STATUS_ID)!.options.label)).toBe('No plugin settings')
    expect(b.slots.getVersion(SEAT)).toBe(version)
    b.locale.setLocale('zh')
    await fiber.dispose()
    expect(dynamicEntries(b.slots)).toHaveLength(0)
    expect(() => b.locale.register('settings-plugins', 'zh', {})).not.toThrow()
    expect(() => b.locale.register('settings-plugins', 'en', {})).not.toThrow()
  })

  it('re-registers the whole catalog after the declaring chain collapses', async () => {
    const b = await bench({
      settingsDescribe: vi.fn(() => Promise.resolve(settingsResponse([
        settingsView('alpha'), settingsView('beta'),
      ]))),
    })
    const collapse = declare(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => {
      expect(dynamicIds(b.slots)).toEqual(['plugin:settings:alpha', 'plugin:settings:beta'])
    })
    collapse()
    expect(b.slots.entries(SEAT)).toHaveLength(0)
    declare(b.slots)
    await vi.waitFor(() => {
      expect(dynamicIds(b.slots)).toEqual(['plugin:settings:alpha', 'plugin:settings:beta'])
    })
  })

  it('removes pending deferrals and live entries with the owning fiber', async () => {
    const pending = await bench()
    const pendingFiber = pending.ctx.plugin({ inject: [...inject], apply })
    await pendingFiber.await()
    await vi.waitFor(() => { expect(pending.settingsDescribe).toHaveBeenCalledOnce() })
    await pendingFiber.dispose()
    declare(pending.slots)
    await Promise.resolve()
    expect(dynamicEntries(pending.slots)).toHaveLength(0)

    const live = await bench()
    declare(live.slots)
    const liveFiber = live.ctx.plugin({ inject: [...inject], apply })
    await liveFiber.await()
    await vi.waitFor(() => { expect(dynamicEntries(live.slots)).toHaveLength(1) })
    await liveFiber.dispose()
    expect(dynamicEntries(live.slots)).toHaveLength(0)
  })
})
