/** Invariant companion: the crawl must cover the registry whenever both are mounted. */
import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import z from 'schemastery'
import InvariantService from '@deepseek-ai/dsh-invariants'
import * as CrawlerInvariant from '../src/invariant.ts'
import { Settings, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'

class MemorySettings extends Settings {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** A crawler whose enumeration omits a chosen namespace set (static brokenness). */
function omittingCrawler(ctx: Context, omitted: Set<string>) {
  return {
    namespaces: () => ctx.get('settings')!.describe()
      .map(descriptor => descriptor.ns)
      .filter(ns => !omitted.has(String(ns))),
  }
}

describe('web-config-crawler invariants', () => {
  it('installs cleanly when the crawler covers every registered namespace', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await ctx.plugin(MemorySettings)
    ctx.settings.register(settingsNamespace('alpha'), z.object({ a: z.string() }))
    ctx.provide('webConfigCrawler', omittingCrawler(ctx, new Set()))
    await expect(ctx.plugin(CrawlerInvariant)).resolves.toBeDefined()
  })

  it('fails the install when the crawler already omits a registered namespace', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await ctx.plugin(MemorySettings)
    ctx.settings.register(settingsNamespace('alpha'), z.object({ a: z.string() }))
    ctx.provide('webConfigCrawler', omittingCrawler(ctx, new Set(['alpha'])))
    await expect(ctx.plugin(CrawlerInvariant)).rejects.toThrow(/omits registered settings namespace/)
  })

  it('rechecks after a raw-section change and fails a new omission', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await ctx.plugin(MemorySettings)
    ctx.settings.register(settingsNamespace('alpha'), z.object({ a: z.string() }))
    const omitted = new Set<string>()
    ctx.provide('webConfigCrawler', omittingCrawler(ctx, omitted))
    await ctx.plugin(CrawlerInvariant)
    // A namespace registers later while the crawler statically omits it; the
    // change-time recheck must catch the gap.
    omitted.add('beta')
    ctx.settings.register(settingsNamespace('beta'), z.object({ b: z.boolean() }))
    expect(() => {
      ctx.emit('settings/document-updated', settingsNamespace('beta'), 1)
    }).toThrow(/omits registered settings namespace/)
  })

  it('skips the check when the crawler is not mounted', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await ctx.plugin(MemorySettings)
    ctx.settings.register(settingsNamespace('alpha'), z.object({ a: z.string() }))
    await ctx.plugin(CrawlerInvariant)
    expect(() => {
      ctx.emit('settings/document-updated', settingsNamespace('alpha'), 1)
    }).not.toThrow()
  })
})
