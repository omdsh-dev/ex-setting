/**
 * Real-loader guard for the crawler's exposure widening: the child imports
 * the gateway AFTER the test kit bootstrapped the static
 * `web-config-crawler/exposed-namespaces` stub, so the gateway's private
 * `exposedNamespaces()` decision is the transformed function. The fixture
 * asserts that a plugin-only namespace stays unserved before the crawler
 * mounts, becomes served once it mounts (the full-enumeration opt-in the
 * deployment makes by mounting the plugin), and that a namespace registered
 * after the mount is picked up at call time — the live-resolution guarantee
 * the direct core edit used to make.
 */

import z from 'schemastery'

export default async () => {
  const { Context } = await import('@deepseek-ai/cordis')
  const { SettingsProvider, settingsNamespace } = await import('@deepseek-ai/dsh-settings')
  const { createApiProxy } = await import('@deepseek-ai/dsh-host-apiproxy')
  const Crawler = await import('../../../src/index.ts')

  class MemorySettings extends SettingsProvider {
    get writable() { return true }
    load() { return Promise.resolve({}) }
    persist() { return Promise.resolve() }
  }

  const ctx = new Context()
  await ctx.plugin(MemorySettings)
  ctx.settings.register(settingsNamespace('plugin'), z.object({ greeting: z.string().default('hi') }))
  ctx.provide('llm', { listConfigurableProviders: () => [] })
  ctx.provide('userQuestions', { registerProvider: () => () => {} })
  const api = createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/' })
  const describe = async () => {
    const response = await api.settings.describe({ rpcId: 'check', payload: {} })
    if (!response.result.ok) throw new Error(`settings.describe failed: ${response.result.error.message}`)
    return response.result.value.namespaces.map(view => view.ns)
  }

  // Without the crawler, the allowlist stays authoritative: the plugin-only
  // namespace is not served even though the transformed gateway could widen.
  const before = await describe()

  // Mounting the crawler binds the exposure handler; the patch fires on the
  // next decision call and adds every enumerated namespace.
  await ctx.plugin(Crawler)
  const after = await describe()

  // The enumeration resolves at call time: a namespace registered after the
  // crawler mounted is served on the next describe without re-registration.
  ctx.settings.register(settingsNamespace('late'), z.object({ flag: z.boolean().default(false) }))
  const live = await describe()

  await ctx.fiber.dispose()
  return { before, after, live }
}
