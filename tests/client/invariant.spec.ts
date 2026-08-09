/** Invariant companion: the empty installer registers and disposes cleanly. */
import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import InvariantService from '@deepseek-ai/dsh-invariants'
import * as PluginSettingsInvariant from '../../src/invariant.ts'

describe('ui-settings-plugins invariants', () => {
  it('registers its companion without a runtime check', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await expect(ctx.plugin(PluginSettingsInvariant)).resolves.toBeDefined()
  })

  it('host apply provides the crawler service', async () => {
    const { apply } = await import('../../src/index.ts')
    const ctx = new Context()
    apply(ctx, { overlayPath: '/tmp/dsh-ex-setting-test-config.yaml' })
    expect(ctx.get('webConfigCrawler')).toBeDefined()
    await ctx.fiber.dispose()
  })
})
