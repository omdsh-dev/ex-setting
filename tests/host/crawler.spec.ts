/**
 * Crawler unit contract: the service mirrors the settings registry live, and
 * the exposure-widening handler feeds the crawler's enumeration into the
 * gateway's exposure Set — the decision the Fabric patch makes at call time.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import type { FabricCall } from 'cordis-fabric-api/compat'
import {
  apply, inject, widenExposedNamespaces, exposedNamespacesTarget, EXPOSED_NAMESPACES_PATCH,
  type WebConfigCrawler,
} from '../../src/index.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** A crawler face whose enumeration is the given namespace ids. */
function crawlerWith(namespaces: SettingsNamespace[]): WebConfigCrawler {
  return {
    namespaces: () => namespaces,
    compositionConfigs: () => [],
    updateComposition: async () => { throw new Error('unused') },
    removeComposition: async () => { throw new Error('unused') },
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

  it('widens the exposure set with every enumerated namespace at call time', () => {
    const call: FabricCall = {
      arguments: [],
      self: undefined,
      result: new Set(['llm-deepseek', 'ui-onboarding']),
    }
    widenExposedNamespaces(call, crawlerWith([settingsNamespace('plugin'), settingsNamespace('llm-deepseek')]))
    // The traced Set is mutated in place, so the gateway's caller reads the
    // widened set; duplicates and allowlist members coexist idempotently.
    expect([...call.result as Set<string>]).toEqual(['llm-deepseek', 'ui-onboarding', 'plugin'])
  })

  it('no-ops when the traced result is not an exposure Set', () => {
    const call: FabricCall = { arguments: [], self: undefined, result: undefined }
    widenExposedNamespaces(call, crawlerWith([settingsNamespace('plugin')]))
    expect(call.result).toBeUndefined()
  })

  it('declares the exposure patch target the web roster stub shares', () => {
    expect(EXPOSED_NAMESPACES_PATCH).toBe('web-config-crawler/exposed-namespaces')
    expect(exposedNamespacesTarget).toEqual({
      module: '@deepseek-ai/dsh-host-apiproxy',
      versionRange: '>=0.0.1-0',
      filePaths: ['src/api-proxy.ts', 'lib/index.js'],
      functionQuery: { functionName: 'exposedNamespaces', kind: 'Sync' },
    })
  })
})
