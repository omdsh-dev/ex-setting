/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-ex-setting/client`.
 * @module @deepseek-ai/dsh-ex-setting/client/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-ex-setting/client'

/** Cordis companion plugin name. */
export const name = 'client-ui-settings-plugins-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: a settings-section plugin that renders whatever the
 * host wire serves and emits no cordis events of its own — the crawl
 * completeness contract lives in the host crawler's companion.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
