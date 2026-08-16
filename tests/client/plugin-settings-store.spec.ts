// @vitest-environment jsdom
/** Plugin settings catalog store: wire ordering, entry projection, and error paths. */
import { describe, expect, it, vi } from 'vitest'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-client-connection/client'
import {
  PluginSettingsStore, pluginSettingsEntries, pluginSettingsEntry, settingsMessage,
} from '../../src/client/plugin-settings-store.ts'
import type { CrawlerCompositionApi } from '../../src/client/crawler-api.ts'

/** A crawler face whose enumeration is empty and whose edits are inert. */
function emptyCrawler(): CrawlerCompositionApi {
  return {
    describe: vi.fn(async () => []),
    update: vi.fn(async () => ({ id: 'unused', schema: {}, value: {}, secrets: [] })),
    remove: vi.fn(async () => {}),
  }
}

function exposed(ns: string): SettingsNamespaceView {
  return {
    ns,
    schema: {},
    value: {},
    applies: 'live',
    secrets: [],
    revision: 0,
  }
}

function okDescribe(namespaces: SettingsNamespaceView[], writable = true) {
  return vi.fn(() => Promise.resolve({
    rpcId: 'c' as never,
    result: { ok: true as const, value: { writable, namespaces } },
  }))
}

function apiOf(describe: ReturnType<typeof vi.fn>) {
  return {
    settings: { describe },
  } as never
}

describe('PluginSettingsStore', () => {
  it('retains every served namespace, ordered by namespace id', async () => {
    const describe = okDescribe([
      exposed('z'),
      exposed('hidden'),
      exposed('b'),
      exposed('a'),
    ])
    const store = new PluginSettingsStore(apiOf(describe), emptyCrawler())
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({
      status: 'ready',
      error: null,
      writable: true,
    })
    expect(store.store.getSnapshot().namespaces.map(view => view.ns)).toEqual(['a', 'b', 'hidden', 'z'])
    expect(store.store.getSnapshot().composition).toEqual([])
  })

  it('retains composition rows alongside settings namespaces, ordered by id', async () => {
    const describe = okDescribe([exposed('z'), exposed('a')])
    const compositionDescribe = vi.fn(() => Promise.resolve([
      { id: 'session', name: 'Web crawler', schema: {}, value: {}, secrets: [] },
      { id: 'a', schema: {}, value: {}, secrets: [] },
      { id: 'crawler', name: 'Web crawler', schema: {}, value: {}, secrets: [] },
    ]))
    const store = new PluginSettingsStore({ settings: { describe } } as never, {
      describe: compositionDescribe,
      update: vi.fn(),
      remove: vi.fn(),
    })
    await store.load()
    const state = store.store.getSnapshot()
    expect(state.namespaces.map(view => view.ns)).toEqual(['a', 'z'])
    expect(state.composition.map(view => view.id)).toEqual(['a', 'crawler', 'session'])
    expect(pluginSettingsEntries(state).map(entry => [entry.key, entry.label])).toEqual([
      ['settings:a', 'a'],
      ['settings:z', 'z'],
      ['composition:a', 'a · Config'],
      ['composition:crawler', 'Web crawler'],
      ['composition:session', 'session'],
    ])
    expect(pluginSettingsEntry(state, 'settings:a')?.kind).toBe('settings')
    expect(pluginSettingsEntry(state, 'composition:a')?.kind).toBe('composition')
    expect(pluginSettingsEntry(state, 'composition:crawler')?.kind).toBe('composition')
    expect(pluginSettingsEntry(state, 'settings:missing')).toBeUndefined()
  })

  it('surfaces a rejected describe as an error with its message', async () => {
    const describe = vi.fn(() => Promise.reject(new Error('boom')))
    const store = new PluginSettingsStore(apiOf(describe), emptyCrawler())
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({ status: 'error', error: 'boom' })
  })

  it('stringifies a non-Error rejection and a business rejection', async () => {
    const stringRejection = new PluginSettingsStore({
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- deliberately exercises the non-Error rejection path
      settings: { describe: vi.fn(() => Promise.reject('plain-failure')) },
    } as never, emptyCrawler())
    await stringRejection.load()
    expect(stringRejection.store.getSnapshot()).toMatchObject({ status: 'error', error: 'plain-failure' })

    const business = new PluginSettingsStore({
      settings: {
        describe: vi.fn(() => Promise.resolve({
          rpcId: 'c' as never,
          result: { ok: false as const, error: { code: 'settings-rejected', message: 'denied', details: {} } },
        })),
      },
    } as never, emptyCrawler())
    await business.load()
    expect(business.store.getSnapshot()).toMatchObject({ status: 'error', error: 'denied' })
  })

  it('lets the newest load win when an older response lands late', async () => {
    let settle!: (value: unknown) => void
    const deferred = new Promise((resolve) => { settle = resolve })
    const describe = vi.fn()
      .mockReturnValueOnce(deferred)
      .mockReturnValueOnce(Promise.resolve({
        rpcId: 'c' as never,
        result: { ok: true as const, value: { writable: true, namespaces: [exposed('second')] } },
      }))
    const store = new PluginSettingsStore(apiOf(describe), emptyCrawler())
    const stale = store.load()
    await store.load()
    settle({
      rpcId: 'c' as never,
      result: { ok: true as const, value: { writable: true, namespaces: [exposed('first')] } },
    })
    await stale
    expect(store.store.getSnapshot().namespaces.map(view => view.ns)).toEqual(['second'])
  })

  it('ignores a stale load failure after a newer load started', async () => {
    let reject!: (reason?: unknown) => void
    const deferred = new Promise((_, failure) => { reject = failure })
    const describe = vi.fn()
      .mockReturnValueOnce(deferred)
      .mockReturnValueOnce(Promise.resolve({
        rpcId: 'c' as never,
        result: { ok: true as const, value: { writable: true, namespaces: [exposed('second')] } },
      }))
    const store = new PluginSettingsStore(apiOf(describe), emptyCrawler())
    const stale = store.load()
    await store.load()
    reject(new Error('late'))
    await stale
    expect(store.store.getSnapshot()).toMatchObject({ status: 'ready' })
    expect(store.store.getSnapshot().namespaces.map(view => view.ns)).toEqual(['second'])
  })

  it('degrades an unreachable crawler route to an empty composition', async () => {
    const describe = okDescribe([exposed('a')])
    const store = new PluginSettingsStore(
      { settings: { describe } } as never,
      { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
    )
    await store.load()
    expect(store.store.getSnapshot()).toMatchObject({ status: 'ready', error: null })
    expect(store.store.getSnapshot().composition).toEqual([])
  })

  it('settingsMessage reads the Error message or stringifies any other value', () => {
    expect(settingsMessage(new Error('typed'))).toBe('typed')
    expect(settingsMessage('plain')).toBe('plain')
  })
})
