// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import z from 'schemastery'
import type {
  IApiClient, SettingsNamespaceView,
} from '@deepseek-ai/dsh-client-connection/client'
import type { CompositionNamespaceView, CrawlerCompositionApi } from '../../src/client/crawler-api.ts'
import {
  PluginSettingsSection, PluginSettingsStatusSection, createPluginSettingsSection, userOpsFor,
} from '../../src/client/PluginSettingsSection.tsx'
import type {
  PluginSettingsSectionCommonProps, PluginSettingsSectionProps,
} from '../../src/client/PluginSettingsSection.tsx'
import { PluginSettingsStore } from '../../src/client/plugin-settings-store.ts'
import type { PluginSettingsState } from '../../src/client/plugin-settings-store.ts'
import { en } from '../../src/client/locales.ts'

afterEach(cleanup)

const t: NonNullable<PluginSettingsSectionProps['t']> = key => (en as Record<string, string>)[key] ?? key

const DemoConfig = z.object({
  greeting: z.string().default('hello').description('Greets the user'),
  enabled: z.boolean().default(true),
  level: z.union(['low', 'high']).default('low'),
  fixed: z.const('fixed'),
  scale: z.union([1, 2]).default(1),
  mixed: z.union(['on', z.number()]),
  retries: z.number().default(3).min(1).max(9).step(1),
  budget: z.number().default(1),
  note: z.string(),
  nick: z.string().required(),
  secretKey: z.string().role('secret'),
  nested: z.object({ host: z.string().default('x'), '': z.string().default('v') }).description('Group hint'),
  labels: z.dict(z.string()),
})

const Wire = JSON.parse(JSON.stringify(DemoConfig.toJSON())) as unknown

function demoNamespace(overrides: Partial<SettingsNamespaceView> = {}): SettingsNamespaceView {
  return {
    ns: 'demo',
    schema: Wire,
    value: {
      greeting: 'hi',
      enabled: true,
      level: 'low',
      scale: 1,
      retries: 5,
      budget: 1,
      nick: 'x',
      nested: { host: 'y', port: 8080, '': 'v' },
      labels: {},
    },
    user: { greeting: 'hi', nested: { host: 'y' } },
    base: { retries: 5, nested: { port: 8080 }, nick: 'x' },
    applies: 'live',
    secrets: [{ path: ['secretKey'], set: true }],
    revision: 7,
    ...overrides,
  }
}

function okResponse(namespace: SettingsNamespaceView) {
  return Promise.resolve({ rpcId: 'c' as never, result: { ok: true as const, value: namespace } })
}

function commonProps(
  store: PluginSettingsStore,
  api: Pick<IApiClient, 'settings'>,
  crawler: CrawlerCompositionApi,
): PluginSettingsSectionCommonProps {
  const usePluginSettings = ((selector: (state: PluginSettingsState) => unknown) =>
    selector(store.store.getSnapshot())) as PluginSettingsSectionCommonProps['usePluginSettings']
  return {
    usePluginSettings,
    reload: () => store.load(),
    mutateSettings: request => api.settings.mutate(request),
    updateComposition: request => crawler.update(request.id, request.ops),
    removeComposition: request => crawler.remove(request.id),
    t,
  } as PluginSettingsSectionCommonProps
}

function mount(
  store: PluginSettingsStore,
  api: Pick<IApiClient, 'settings'>,
  pluginKey: PluginSettingsSectionProps['pluginKey'] = 'settings:demo',
  crawler: CrawlerCompositionApi = { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
) {
  return render(<PluginSettingsSection {...commonProps(store, api, crawler)} pluginKey={pluginKey} />)
}

function mountStatus(
  store: PluginSettingsStore,
  api: Pick<IApiClient, 'settings'> = { settings: {} } as never,
  crawler: CrawlerCompositionApi = { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
) {
  return render(<PluginSettingsStatusSection {...commonProps(store, api, crawler)} />)
}

function readyStore(namespaces: SettingsNamespaceView[], writable = true): PluginSettingsStore {
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'c' as never,
    result: {
      ok: true as const,
      value: { writable, namespaces },
    },
  }))
  const store = new PluginSettingsStore(
    { settings: { describe } } as never,
    { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
  )
  store.store.update((state) => {
    state.status = 'ready'
    state.error = null
    state.writable = writable
    state.namespaces = namespaces
  })
  return store
}

function compositionRow(overrides: Partial<CompositionNamespaceView> = {}): CompositionNamespaceView {
  return {
    id: 'session',
    schema: JSON.parse(JSON.stringify(z.object({ retries: z.number().default(3) }).toJSON())),
    value: { retries: 3 },
    secrets: [],
    ...overrides,
  }
}

/** Replace one serialized ref's meta description, on a detached clone. */
function withDescription(wire: unknown, metaDefault: unknown, description: unknown): unknown {
  const clone = structuredClone(wire) as { refs: Record<string, { meta?: Record<string, unknown> }> }
  for (const ref of Object.values(clone.refs)) {
    if (ref.meta?.['default'] === metaDefault) {
      ref.meta = { ...ref.meta, description }
      break
    }
  }
  return clone
}

/** Strip one ref's type and meta entirely (a structurally incomplete wire). */
function stripRef(wire: unknown, metaDefault: unknown): unknown {
  const clone = structuredClone(wire) as { refs: Record<string, { type?: string; meta?: Record<string, unknown> }> }
  for (const ref of Object.values(clone.refs)) {
    if (ref.meta?.['default'] === metaDefault) {
      delete ref.type
      delete ref.meta
      break
    }
  }
  return clone
}

describe('userOpsFor', () => {
  const namespace = demoNamespace()

  it('emits set ops only for changed draft fields, preserving untouched secrets', () => {
    const ops = userOpsFor(namespace, { greeting: 'hola', nested: { host: 'y' } }, new Set())
    expect(ops).toEqual([{ op: 'set', path: ['greeting'], value: 'hola' }])
  })

  it('unsets removed fields and emits nothing for an unchanged draft', () => {
    // Dropping the whole nested subtree unsets the parent key in one op.
    const removed = userOpsFor(namespace, { greeting: 'hi' }, new Set())
    expect(removed).toEqual([{ op: 'unset', path: ['nested'] }])
    expect(userOpsFor(namespace, { greeting: 'hi', nested: { host: 'y' } }, new Set())).toEqual([])
  })

  it('appends an explicit unset for a cleared secret and never for an untouched one', () => {
    const ops = userOpsFor(namespace, { greeting: 'hola', nested: { host: 'y' } }, new Set([JSON.stringify(['secretKey'])]))
    expect(ops).toEqual([
      { op: 'set', path: ['greeting'], value: 'hola' },
      { op: 'unset', path: ['secretKey'] },
    ])
  })
})

describe('PluginSettingsSection', () => {
  it('renders only the registration-bound namespace editor', () => {
    const store = readyStore([demoNamespace()])
    mount(store, { settings: {} } as never)
    expect(screen.getByRole('heading', { name: 'demo' })).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getByText('Applies immediately')).toBeTruthy()
    expect(screen.getByText('Greets the user')).toBeTruthy()
    expect(screen.getByText('Group hint')).toBeTruthy()
    expect((screen.getByLabelText<HTMLInputElement>('Greeting')).value).toBe('hi')
    expect((screen.getByLabelText<HTMLInputElement>('Retries')).value).toBe('5')
    expect((screen.getByLabelText<HTMLInputElement>('Retries')).min).toBe('1')
    expect((screen.getByLabelText<HTMLInputElement>('Retries')).max).toBe('9')
    expect((screen.getByLabelText<HTMLInputElement>('Retries')).step).toBe('1')
    expect((screen.getByLabelText<HTMLInputElement>('Budget')).value).toBe('1')
    expect((screen.getByLabelText<HTMLInputElement>('Budget')).min).toBe('')
    expect((screen.getByLabelText<HTMLInputElement>('Nick')).value).toBe('x')
    expect(screen.getByText('*')).toBeTruthy()
    expect((screen.getByLabelText<HTMLInputElement>('Note')).value).toBe('')
    expect((screen.getByLabelText<HTMLInputElement>('Enabled')).checked).toBe(true)
    expect((screen.getByLabelText<HTMLSelectElement>('Level')).value).toBe('low')
    expect((screen.getByLabelText<HTMLSelectElement>('Scale')).value).toBe('1')
    expect(screen.getByText('fixed')).toBeTruthy()
    expect((screen.getByLabelText<HTMLInputElement>('Secret Key')).type).toBe('password')
    expect((screen.getByLabelText<HTMLInputElement>('Secret Key')).placeholder).toBe(en.secretConfigured)
    expect((screen.getByLabelText<HTMLInputElement>('Host')).value).toBe('y')
    expect(screen.getByText(en.jsonHint)).toBeTruthy()
  })

  it('saves the edited user layer as path ops with the read revision', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Greeting'), { target: { value: 'hola' } })
    fireEvent.change(screen.getByLabelText<HTMLSelectElement>('Level'), { target: { value: 'high' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ns: 'demo',
        ops: [
          { op: 'set', path: ['greeting'], value: 'hola' },
          { op: 'set', path: ['level'], value: 'high' },
        ],
        expectedRevision: 7,
      })
    })
    expect(screen.getByText(en.saved)).toBeTruthy()
  })

  it('writes boolean and numeric edits as path ops', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    fireEvent.click(screen.getByLabelText<HTMLInputElement>('Enabled'))
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Retries'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText<HTMLSelectElement>('Scale'), { target: { value: '2' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ns: 'demo',
        ops: [
          { op: 'set', path: ['enabled'], value: false },
          { op: 'set', path: ['retries'], value: 6 },
          { op: 'set', path: ['scale'], value: 2 },
        ],
        expectedRevision: 7,
      })
    })
    // Clearing a numeric field removes it from the draft; the still-edited
    // boolean and scale fields are rewritten on the next save.
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Retries'), { target: { value: '' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenLastCalledWith({
        ns: 'demo',
        ops: [
          { op: 'set', path: ['enabled'], value: false },
          { op: 'set', path: ['scale'], value: 2 },
        ],
        expectedRevision: 7,
      })
    })
  })

  it('clearing a configured secret adds an unset op and keeps other edits', async () => {
    // An empty user layer leaves the set secret as the only resettable field.
    const store = readyStore([demoNamespace({ user: {} })])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    fireEvent.click(screen.getByText(en.reset))
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ns: 'demo',
        ops: [{ op: 'unset', path: ['secretKey'] }],
        expectedRevision: 7,
      })
    })
  })

  it('resetting an overridden field unsets it back to the base', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    const resets = screen.getAllByText(en.reset)
    fireEvent.click(resets[0] as HTMLElement)
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ns: 'demo',
        ops: [{ op: 'unset', path: ['greeting'] }],
        expectedRevision: 7,
      })
    })
  })

  it('typing and clearing a secret leaves the draft untouched', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    const secret = screen.getByLabelText<HTMLInputElement>('Secret Key')
    fireEvent.change(secret, { target: { value: 'abc' } })
    fireEvent.change(secret, { target: { value: '' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.getByText(en.saved)).toBeTruthy() })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('renders descriptions from schema metadata records and ignores non-text shapes', () => {
    const withRecords = demoNamespace({
      schema: stripRef(
        withDescription(
          withDescription(
            withDescription(
              withDescription(Wire, 'hello', { en: 'Greets the user', zh: '问候语' }),
              'low',
              { en: 42, zh: '问候语' },
            ),
            3,
            42,
          ),
          1,
          { en: 1, zh: 2 },
        ),
        'x',
      ),
    })
    const store = readyStore([withRecords])
    mount(store, { settings: {} } as never)
    expect(screen.getByText('Greets the user')).toBeTruthy()
    expect(screen.getByText('问候语')).toBeTruthy()
    // The numeric description (retries) and the text-less record (scale)
    // render no hint at all; the type-less host ref falls back to JSON.
    expect(screen.queryByText('42')).toBeNull()
    expect(screen.getAllByRole('textbox').filter(el => el.tagName === 'TEXTAREA').length).toBeGreaterThanOrEqual(2)
  })

  it('treats a role-declared secret without a listed slot as a password input', () => {
    // The wire always lists redacted slots; a missing list entry is defensive.
    const store = readyStore([demoNamespace({ secrets: [] })])
    mount(store, { settings: {} } as never)
    expect((screen.getByLabelText<HTMLInputElement>('Secret Key')).type).toBe('password')
    expect((screen.getByLabelText<HTMLInputElement>('Secret Key')).placeholder).toBe('')
  })

  it('renders a root JSON schema as a JSON editor', async () => {
    const anySchema = JSON.parse(JSON.stringify(z.any().toJSON())) as unknown
    const store = readyStore([demoNamespace({ schema: anySchema, value: undefined, user: undefined, base: undefined })])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    const json = screen.getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA') as HTMLTextAreaElement
    expect(json.getAttribute('aria-label')).toBe('Value')
    expect(json.value).toBe('{}')
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        ns: 'demo',
        ops: [{ op: 'set', path: [], value: {} }],
        expectedRevision: 7,
      })
    })
  })

  it('reports an unparseable schema as the invalid-schema error', () => {
    const store = readyStore([demoNamespace({ schema: {} })])
    mount(store, { settings: {} } as never)
    expect(screen.getByText(en.invalidSchema)).toBeTruthy()
  })

  it('blocks saving while a JSON field is invalid and clears the error on valid input', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    const json = screen.getAllByRole('textbox').find(el => el.tagName === 'TEXTAREA') as HTMLTextAreaElement
    fireEvent.change(json, { target: { value: '{oops' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.getByText(en.invalidJson)).toBeTruthy() })
    expect(mutate).not.toHaveBeenCalled()
    // A later save re-runs apply, which clears the stale card-level failure.
    fireEvent.change(json, { target: { value: '{"a":"b"}' } })
    fireEvent.change(json, { target: { value: '' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.getByText(en.saved)).toBeTruthy() })
    expect(mutate).not.toHaveBeenCalled()
  })

  it('surfaces a schema validation failure without writing', async () => {
    const store = readyStore([demoNamespace()])
    const mutate = vi.fn(() => okResponse(demoNamespace()))
    mount(store, { settings: { mutate } } as never)
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Retries'), { target: { value: '0' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.queryByText(en.saved)).toBeNull() })
    expect(mutate).not.toHaveBeenCalled()
    expect(screen.getByText(/Retries/)).toBeTruthy()
  })

  it('shows conflict copy and reloads when the host refuses a stale write', async () => {
    const describe = vi.fn(() => Promise.resolve({
      rpcId: 'c' as never,
      result: {
        ok: true as const,
        value: { writable: true, namespaces: [demoNamespace()] },
      },
    }))
    const mutate = vi.fn(() => Promise.resolve({
      rpcId: 'c' as never,
      result: {
        ok: false as const,
        error: { code: 'settings-conflict', message: 'stale', details: {} },
      },
    }))
    // The catalog store and the editor share one wire face, so the reload after a
    // conflict lands on the same describe mock.
    const api = { settings: { mutate, describe } } as never
    const store = new PluginSettingsStore(api, {
      describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn(),
    })
    store.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = true
      state.namespaces = [demoNamespace()]
    })
    mount(store, api)
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Greeting'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.getByText(en.conflict)).toBeTruthy() })
    expect(describe).toHaveBeenCalled()
  })

  it('shows a plain rejection message without reloading', async () => {
    const describe = vi.fn()
    const mutate = vi.fn(() => Promise.resolve({
      rpcId: 'c' as never,
      result: {
        ok: false as const,
        error: { code: 'settings-rejected', message: 'denied', details: {} },
      },
    }))
    const api = { settings: { mutate, describe } } as never
    const store = new PluginSettingsStore(api, {
      describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn(),
    })
    store.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = true
      state.namespaces = [demoNamespace()]
    })
    mount(store, api)
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Greeting'), { target: { value: 'hola' } })
    fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
    await waitFor(() => { expect(screen.getByText('denied')).toBeTruthy() })
    expect(describe).not.toHaveBeenCalled()
  })

  it('surfaces a transport rejection on the card, Error or not', async () => {
    const withFailure = (rejection: unknown) => {
      const store = readyStore([demoNamespace()])
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- deliberately exercises the non-Error rejection path
      const mutate = vi.fn(() => Promise.reject(rejection))
      mount(store, { settings: { mutate } } as never)
      fireEvent.change(screen.getByLabelText<HTMLInputElement>('Greeting'), { target: { value: 'hola' } })
      fireEvent.click(screen.getByText<HTMLButtonElement>(en.save))
      return mutate
    }
    withFailure(new Error('offline'))
    await waitFor(() => { expect(screen.getByText('offline')).toBeTruthy() })
    cleanup()
    withFailure('plain-failure')
    await waitFor(() => { expect(screen.getByText('plain-failure')).toBeTruthy() })
  })

  it('disables every control and the save button on a read-only provider', () => {
    const store = readyStore([demoNamespace()], false)
    mount(store, { settings: {} } as never)
    expect(screen.getByText(en.readOnly)).toBeTruthy()
    expect((screen.getByLabelText<HTMLInputElement>('Greeting')).disabled).toBe(true)
    expect(screen.getByText<HTMLButtonElement>(en.save).disabled).toBe(true)
  })

  it('announces restart-required namespaces', () => {
    const store = readyStore([demoNamespace({ applies: 'restart' })])
    mount(store, { settings: {} } as never)
    expect(screen.getByText(en.restart)).toBeTruthy()
    expect(screen.getByText(en.restartNotice)).toBeTruthy()
  })

  it('preserves drafts across equivalent refreshes and remounts for changed descriptors', () => {
    const store = readyStore([demoNamespace()])
    const api = { settings: {} } as never
    const view = mount(store, api)
    fireEvent.change(screen.getByLabelText<HTMLInputElement>('Greeting'), { target: { value: 'hola' } })
    store.store.update((state) => { state.namespaces = [demoNamespace()] })
    view.rerender(<PluginSettingsSection {...commonProps(store, api, {
      describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn(),
    })} pluginKey="settings:demo" />)
    expect(screen.getByLabelText<HTMLInputElement>('Greeting').value).toBe('hola')

    store.store.update((state) => {
      state.namespaces = [demoNamespace({
        revision: 8,
        value: { ...(demoNamespace().value as Record<string, unknown>), greeting: 'remote' },
        user: { greeting: 'remote', nested: { host: 'y' } },
      })]
    })
    view.rerender(<PluginSettingsSection {...commonProps(store, api, {
      describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn(),
    })} pluginKey="settings:demo" />)
    expect(screen.getByLabelText<HTMLInputElement>('Greeting').value).toBe('remote')
  })

  it('keeps a stale editor available when a background refresh fails', () => {
    const store = readyStore([demoNamespace()])
    store.store.update((state) => {
      state.status = 'error'
      state.error = 'refresh failed'
    })
    const load = vi.spyOn(store, 'load').mockImplementation(async () => {})
    mount(store, { settings: {} } as never)
    expect(screen.getByRole('heading', { name: 'demo' })).toBeTruthy()
    expect(screen.getByText(`${en['status.loadFailed']}: refresh failed`)).toBeTruthy()
    fireEvent.click(screen.getByText(en['status.retry']))
    expect(load).toHaveBeenCalled()
    cleanup()
    store.store.update((state) => { state.error = null })
    mount(store, { settings: {} } as never)
    expect(screen.getByText(/^Could not load plugin settings:$/)).toBeTruthy()
  })

  it('shows the empty catalog status only in the temporary status section', () => {
    const store = readyStore([])
    mountStatus(store)
    expect(screen.getByText(en['status.empty'])).toBeTruthy()
    cleanup()
    const populated = readyStore([demoNamespace()])
    const { container } = mountStatus(populated)
    expect(container.firstChild).toBeNull()
  })

  it('surfaces an initial load failure with a retry that reloads', () => {
    const store = new PluginSettingsStore(
      { settings: { describe: vi.fn() } } as never,
      { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
    )
    store.store.update((state) => {
      state.status = 'error'
      state.error = 'boom'
    })
    const load = vi.spyOn(store, 'load').mockImplementation(async () => {})
    mountStatus(store)
    expect(screen.getByText(`${en['status.loadFailed']}: boom`)).toBeTruthy()
    fireEvent.click(screen.getByText(en['status.retry']))
    expect(load).toHaveBeenCalled()
  })

  it('renders an error status even when the failure text is empty', () => {
    const store = new PluginSettingsStore(
      { settings: { describe: vi.fn() } } as never,
      { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
    )
    store.store.update((state) => {
      state.status = 'error'
      state.error = null
    })
    mountStatus(store)
    expect(screen.getByText(/^Could not load plugin settings:$/)).toBeTruthy()
  })

  it('renders null after a bound source disappears and binds factory components to distinct keys', () => {
    const store = readyStore([demoNamespace(), demoNamespace({ ns: 'other' })])
    const props = commonProps(store, { settings: {} } as never, {
      describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn(),
    })
    const Demo = createPluginSettingsSection('settings:demo')
    const Other = createPluginSettingsSection('settings:other')
    expect(Demo).not.toBe(Other)
    const { rerender } = render(<Demo {...props} />)
    expect(screen.getByRole('heading', { name: 'demo' })).toBeTruthy()
    store.store.update((state) => { state.namespaces = [] })
    rerender(<Demo {...props} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('shows a loading notice while the first describe is in flight', () => {
    const store = new PluginSettingsStore(
      { settings: { describe: vi.fn() } } as never,
      { describe: vi.fn(async () => []), update: vi.fn(), remove: vi.fn() },
    )
    store.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    mountStatus(store)
    expect(screen.getByText(en['status.loading'])).toBeTruthy()
  })

  it('renders a registration-bound composition editor without an inner navigation list', () => {
    const store = readyStore([])
    store.store.update((state) => {
      state.composition = [compositionRow({ name: 'Session service' })]
    })
    mount(store, { settings: {} } as never, 'composition:session')
    expect(screen.getByRole('heading', { name: 'Session service' })).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.getAllByText(en.restart).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByLabelText<HTMLInputElement>('Retries').value).toBe('3')
    expect(screen.getByRole('button', { name: en['composition.remove'] })).toBeTruthy()
  })

  it('keeps matching settings and composition ids in source-distinct editors', () => {
    const store = readyStore([demoNamespace()])
    store.store.update((state) => {
      state.composition = [compositionRow({ id: 'demo', name: 'Demo service' })]
    })
    const api = { settings: {} } as never
    mount(store, api)
    expect(screen.getByRole('heading', { name: 'demo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: en['composition.remove'] })).toBeNull()
    cleanup()
    mount(store, api, 'composition:demo')
    expect(screen.getByRole('heading', { name: 'Demo service' })).toBeTruthy()
    expect(screen.getByRole('button', { name: en['composition.remove'] })).toBeTruthy()
  })

  it('opens the namespace selected by its registration key', () => {
    const store = readyStore([demoNamespace(), demoNamespace({ ns: 'other', user: {}, value: { greeting: 'other-hi' } })])
    mount(store, { settings: {} } as never, 'settings:other')
    expect(screen.getByRole('heading', { name: 'other' })).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>('Greeting').value).toBe('other-hi')
  })

  it('saves composition edits through composition.update without a revision', async () => {
    const store = readyStore([])
    store.store.update((state) => {
      state.composition = [compositionRow()]
    })
    const update = vi.fn(async () => compositionRow({ value: { retries: 4 } }))
    mount(store, { settings: {} } as never, 'composition:session', {
      describe: vi.fn(async () => []), update, remove: vi.fn(),
    })
    fireEvent.change(screen.getByLabelText('Retries'), { target: { value: '4' } })
    fireEvent.click(screen.getByText(en.save))
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('session', [{ op: 'set', path: ['retries'], value: 4 }])
    })
    expect(screen.getByText(en.saved)).toBeTruthy()
  })

  it('resets a composition row by removing it from the overlay', async () => {
    const describe = vi.fn(() => Promise.resolve({
      rpcId: 'c' as never,
      result: { ok: true as const, value: { writable: true, namespaces: [] } },
    }))
    const crawler = {
      describe: vi.fn(async () => []),
      update: vi.fn(),
      remove: vi.fn(async () => {}),
    }
    const store = new PluginSettingsStore({ settings: { describe } } as never, crawler)
    store.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = true
      state.namespaces = []
      state.composition = [compositionRow()]
    })
    mount(store, { settings: { describe } } as never, 'composition:session', crawler)
    fireEvent.click(screen.getByRole('button', { name: en['composition.remove'] }))
    await waitFor(() => {
      expect(crawler.remove).toHaveBeenCalledWith('session')
    })
    expect(describe).toHaveBeenCalled()
    expect(crawler.describe).toHaveBeenCalled()
  })

  it('surfaces composition write and removal refusals on the card', async () => {
    const store = readyStore([])
    store.store.update((state) => {
      state.composition = [compositionRow()]
    })
    const update = vi.fn(async () => { throw new Error('denied') })
    const remove = vi.fn(async () => { throw new Error('remove-denied') })
    mount(store, { settings: {} } as never, 'composition:session', {
      describe: vi.fn(async () => []), update, remove,
    })
    fireEvent.change(screen.getByLabelText('Retries'), { target: { value: '4' } })
    fireEvent.click(screen.getByText(en.save))
    await waitFor(() => { expect(screen.getByText('denied')).toBeTruthy() })
    fireEvent.click(screen.getByRole('button', { name: en['composition.remove'] }))
    await waitFor(() => { expect(screen.getByText('remove-denied')).toBeTruthy() })
    cleanup()
    const rejecting = readyStore([])
    rejecting.store.update((state) => {
      state.composition = [compositionRow()]
    })
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- deliberately exercises the transport rejection path
    const removeOffline = vi.fn(() => Promise.reject('offline'))
    mount(rejecting, { settings: {} } as never, 'composition:session', {
      describe: vi.fn(async () => []), update: vi.fn(), remove: removeOffline,
    })
    fireEvent.click(screen.getByRole('button', { name: en['composition.remove'] }))
    await waitFor(() => { expect(screen.getByText('offline')).toBeTruthy() })
    cleanup()
    const rejectingError = readyStore([])
    rejectingError.store.update((state) => {
      state.composition = [compositionRow()]
    })
    mount(rejectingError, { settings: {} } as never, 'composition:session', {
      describe: vi.fn(async () => []),
      update: vi.fn(),
      remove: vi.fn(() => Promise.reject(new Error('offline-error'))),
    })
    fireEvent.click(screen.getByRole('button', { name: en['composition.remove'] }))
    await waitFor(() => { expect(screen.getByText('offline-error')).toBeTruthy() })
  })
})
