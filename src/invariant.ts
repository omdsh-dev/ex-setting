/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-ex-setting`.
 * @module @deepseek-ai/dsh-ex-setting/invariant
 */

import type { Context } from 'cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-ex-setting'

/** Cordis companion plugin name. */
export const name = 'web-config-crawler-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Startup contract check: whenever both the crawler and the settings seam are
 * mounted, the crawler's namespace enumeration must cover every registered
 * namespace — the auto-crawl guarantee the gateway relies on. Rechecked after
 * every raw-section change; namespace registration itself emits no seam event,
 * so the check is a boot-time and change-time bound, not a per-registration
 * assertion.
 */
const install: InvariantInstaller = (ctx: Context, fail: (message: string) => never) => {
  const check = (): void => {
    const settings = ctx.get('settings')
    const crawler = ctx.get('webConfigCrawler')
    if (settings === undefined || crawler === undefined) return
    const registered = new Set(settings.describe({ redactSecrets: true }).map(descriptor => String(descriptor.ns)))
    for (const ns of crawler.namespaces()) {
      registered.delete(String(ns))
    }
    if (registered.size > 0) {
      const missing = [...registered].join(', ')
      fail(`web-config-crawler omits registered settings namespace(s): ${missing}`)
    }
  }
  check()
  ctx.on('settings/document-updated', () => { check() })
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
