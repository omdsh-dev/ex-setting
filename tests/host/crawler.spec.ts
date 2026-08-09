/** Crawler unit contract: the service mirrors the settings registry, live. */
import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import z from 'schemastery'
import { Settings, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply, inject } from '../../src/index.ts'

class MemorySettings extends Settings {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('web-config-crawler', () => {
  it('declares the settings service it reads', () => {
    expect(inject).toEqual(['settings'])
  })

  it('enumerates every registered namespace in registration order, live', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings)
    ctx.settings.register(settingsNamespace('alpha'), z.object({ a: z.string() }))
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    const crawler = ctx.get('webConfigCrawler')
    expect(crawler).toBeDefined()
    expect(crawler!.namespaces().map(String)).toEqual(['alpha'])
    ctx.settings.register(settingsNamespace('beta'), z.object({ b: z.boolean() }))
    expect(crawler!.namespaces().map(String)).toEqual(['alpha', 'beta'])
    await fiber.dispose()
    expect(ctx.get('webConfigCrawler')).toBeUndefined()
  })
})
