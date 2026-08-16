/** Invariant companion: the empty installer registers and disposes cleanly. */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantService from '@deepseek-ai/dsh-invariants'
import * as PluginSettingsInvariant from '../../src/client/invariant.ts'

describe('ui-settings-plugins invariants', () => {
  it('registers its companion without a runtime check', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantService)
    await expect(ctx.plugin(PluginSettingsInvariant)).resolves.toBeDefined()
  })

  it('node-half apply rejects without a context', async () => {
    const { apply } = await import('../../src/index.ts')
    // The crawler mounts services from the context; a bare call rejects
    // instead of half-mounting.
    await expect(apply(undefined as never)).rejects.toThrow()
  })
})
