/** Invariant companion: the empty installer registers and disposes cleanly. */
import { describe, expect, it } from 'vitest'
import { Context } from 'cordis'
import InvariantService from '@deepseek-ai/dsh-invariants'
import * as PluginSettingsInvariant from '../../src/client/invariant.ts'

describe('ui-settings-plugins invariants', () => {
  it('registers its companion without a runtime check', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await expect(ctx.plugin(PluginSettingsInvariant)).resolves.toBeDefined()
  })

  it('node-half apply is a no-op host placeholder', async () => {
    const { apply } = await import('@deepseek-ai/dsh-ex-setting')
    apply()
    expect(true).toBe(true) // reaching here without throw is the contract
  })
})
