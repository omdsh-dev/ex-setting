/**
 * Real-composition guard: the crawler and a settings provider boot from a
 * test-only cordis.yml through the actual Loader + Include path, and the
 * crawler service enumerates the namespace a consumer registered — the
 * auto-crawl guarantee the web gateway relies on.
 */

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import Loader from '@cordisjs/plugin-loader'
import Include from '@cordisjs/plugin-include'
import z from 'schemastery'
import { z as zod } from 'zod'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import SettingsLocal from '@deepseek-ai/dsh-settings-local'
import * as Crawler from '../../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('web-config-crawler real composition', () => {
  it('boots from cordis.yml and enumerates every registered namespace', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-web-config-crawler-'))
    const settingsPath = join(root, 'settings.yaml')
    await writeFile(settingsPath, 'consumer:\n  greeting: hi\n')

    const consumer = {
      name: 'crawler-consumer',
      // A schema-carrying composition row: the crawler exposes its Config.
      Config: z.object({
        greeting: z.string().default('hello'),
        secretPath: z.string().role('secret'),
        tags: z.array(z.string()).default([]),
      }),
      apply: (ctx: Context) => {
        ctx.inject(['settings'], (child: Context) => {
          child.settings.register(settingsNamespace('consumer'), z.object({ greeting: z.string().default('hello') }))
        })
      },
    }
    // A native-zod Config row must be skipped by the crawl, not crashed on:
    // it has no schemastery toJSON envelope the editor could rehydrate.
    const nativeConsumer = {
      name: 'native-consumer',
      Config: zod.object({ flag: zod.boolean() }),
      apply: () => {},
    }

    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: settings',
      "  name: '@deepseek-ai/dsh-settings-local'",
      '  config:',
      `    path: ${JSON.stringify(settingsPath)}`,
      '    debounceMs: 10',
      '- id: crawler',
      "  name: '@deepseek-ai/dsh-ex-setting'",
      '- id: consumer',
      '  name: test-crawler-consumer',
      '- id: native-consumer',
      '  name: test-native-consumer',
      '  config: { flag: true }',
      '',
    ].join('\n'))

    const ctx = new Context()
    context = ctx
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-settings-local', SettingsLocal],
      ['@deepseek-ai/dsh-ex-setting', Crawler],
      ['test-crawler-consumer', consumer],
      ['test-native-consumer', nativeConsumer],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()

    const crawler = ctx.get('webConfigCrawler')
    expect(crawler).toBeDefined()
    expect(crawler!.namespaces().map(String)).toEqual(['consumer'])
    // The composition crawl exposes every schema-carrying row — the
    // settings-local and crawler rows carry Configs too — redacted.
    const configs = crawler!.compositionConfigs()
    expect(configs.map(view => view.id)).toContain('consumer')
    expect(configs.map(view => view.id)).not.toContain('native-consumer')
    const consumerView = configs.find(view => view.id === 'consumer')!
    expect(consumerView.value).toEqual({ greeting: 'hello', tags: [] })
    expect(consumerView.secrets).toEqual([{ path: ['secretPath'], set: false }])
  })

  it('persists path edits into the personal overlay and reverts the row on remove', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-web-config-crawler-write-'))
    const settingsPath = join(root, 'settings.yaml')
    await writeFile(settingsPath, 'consumer:\n  greeting: hi\n')
    const overlayPath = join(root, 'personal.yaml')
    // Seed the overlay with an unrelated row the write must preserve.
    await writeFile(overlayPath, '- id: webserver\n  config:\n    port: 3080\n')

    const consumer = {
      name: 'crawler-consumer',
      Config: z.object({
        greeting: z.string().default('hello'),
        secretPath: z.string().role('secret'),
        tags: z.array(z.string()).default([]),
      }),
      apply: () => {},
    }

    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: settings',
      "  name: '@deepseek-ai/dsh-settings-local'",
      '  config:',
      `    path: ${JSON.stringify(settingsPath)}`,
      '    debounceMs: 10',
      '- id: crawler',
      "  name: '@deepseek-ai/dsh-ex-setting'",
      '  config:',
      `    overlayPath: ${JSON.stringify(overlayPath)}`,
      '- id: consumer',
      '  name: test-crawler-consumer',
      '',
    ].join('\n'))

    const ctx = new Context()
    context = ctx
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-settings-local', SettingsLocal],
      ['@deepseek-ai/dsh-ex-setting', Crawler],
      ['test-crawler-consumer', consumer],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()

    const crawler = ctx.get('webConfigCrawler')!
    const updated = await crawler.updateComposition('consumer', [
      { op: 'set', path: ['greeting'], value: 'hola' },
      { op: 'set', path: ['tags', '0'], value: 'a' },
    ])
    expect(updated.value).toEqual({ greeting: 'hola', tags: ['a'] })
    // A second write replaces the existing overlay row; an unset names a
    // field without touching the stored secret.
    const second = await crawler.updateComposition('consumer', [
      { op: 'unset', path: ['tags', '0', 'x'] },
      { op: 'unset', path: ['tags', '0'] },
      { op: 'unset', path: ['greeting'] },
      { op: 'set', path: ['fresh', 'sub'], value: 1 },
    ])
    const secondValue = second.value as { greeting: string; tags: unknown[]; fresh: unknown }
    expect(secondValue.greeting).toBe('hello')
    expect(secondValue.tags).toEqual([])
    expect(secondValue.fresh).toEqual({ sub: 1 })
    await crawler.updateComposition('consumer', [{ op: 'set', path: ['greeting'], value: 'final' }])
    // The overlay gained the consumer row and preserved the seeded row.
    const overlay = await readFile(overlayPath, 'utf8')
    expect(overlay).toContain('id: webserver')
    expect(overlay).toContain('greeting: final')

    await crawler.removeComposition('consumer')
    const after = await readFile(overlayPath, 'utf8')
    expect(after).not.toContain('consumer')
    expect(after).toContain('id: webserver')
    // Removing an absent row is a no-op; removing the last row deletes the
    // overlay file entirely.
    await crawler.removeComposition('consumer')
    await crawler.removeComposition('webserver')
    await expect(readFile(overlayPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses unknown rows and surfaces overlay parse failures', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-web-config-crawler-errors-'))
    const settingsPath = join(root, 'settings.yaml')
    await writeFile(settingsPath, 'consumer:\n  greeting: hi\n')
    const overlayPath = join(root, 'personal.yaml')
    await writeFile(overlayPath, '- id: webserver\n  config:\n    port: [unclosed\n')

    const consumer = {
      // No `name`: the crawl view must fall back to the row id gracefully.
      Config: z.object({ greeting: z.string().default('hello') }),
      apply: () => {},
    }
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- id: settings',
      "  name: '@deepseek-ai/dsh-settings-local'",
      '  config:',
      `    path: ${JSON.stringify(settingsPath)}`,
      '    debounceMs: 10',
      '- id: crawler',
      "  name: '@deepseek-ai/dsh-ex-setting'",
      '  config:',
      `    overlayPath: ${JSON.stringify(overlayPath)}`,
      '- id: consumer',
      '  name: test-crawler-consumer',
      '',
    ].join('\n'))

    const ctx = new Context()
    context = ctx
    ctx.baseUrl = pathToFileURL(root).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-settings-local', SettingsLocal],
      ['@deepseek-ai/dsh-ex-setting', Crawler],
      ['test-crawler-consumer', consumer],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()

    const crawler = ctx.get('webConfigCrawler')!
    const views = crawler.compositionConfigs()
    expect(views.find(view => view.id === 'consumer')?.name).toBeUndefined()
    await expect(crawler.updateComposition('missing', [{ op: 'set', path: ['x'], value: 1 }]))
      .rejects.toThrow(/not a mounted schema-carrying plugin/)
    await expect(crawler.updateComposition('consumer', [{ op: 'set', path: ['greeting'], value: 'x' }]))
      .rejects.toThrow()
    // A non-list overlay document reads as an empty overlay: the write path
    // appends the row; an absent overlay then creates the file.
    await writeFile(overlayPath, 'some: map\n')
    await crawler.updateComposition('consumer', [{ op: 'set', path: ['greeting'], value: 'ok' }])
    await rm(overlayPath, { force: true })
    await crawler.updateComposition('consumer', [{ op: 'unset', path: [] }])
    const reset = await readFile(overlayPath, 'utf8')
    expect(reset).toContain('greeting: hello')
  })
})
