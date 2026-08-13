/**
 * Narrow host contracts for `@deepseek-ai/dsh-ex-setting`.
 *
 * This module is the package's only view of the DSH host runtime. Every
 * `@deepseek-ai/*` package consumed by this bundle is private and not
 * installable from the npm registry, so this repository cannot import their
 * declarations. Instead it declares the smallest structural surface the
 * crawler actually uses on the registry `cordis` Context: the settings
 * service's describe face and the invariants registration face. The host (a
 * composed DSH profile) supplies objects that satisfy these shapes at
 * runtime; the narrow declarations keep the independent package compiling
 * against registry `cordis` without host project references.
 * @module @deepseek-ai/dsh-ex-setting/host-contracts
 */

import type { Context } from 'cordis'

/** One registered settings namespace as surfaced to configuration UIs. */
export interface HostSettingsDescriptor {
  /** The registered namespace (branded string). */
  readonly ns: string
  /** Serialized schemastery schema (`schema.toJSON()`). */
  readonly schema: unknown
  /** Current resolved value. */
  readonly value: unknown
  /** Monotonic revision of the raw user section this descriptor was read at. */
  readonly revision: number
  /** Owner's declared effect timing. */
  readonly applies: 'live' | 'restart'
  /** Schema-declared secret positions; present only under `redactSecrets`. */
  readonly secrets?: Array<{ path: string[]; set: boolean }>
}

/** The settings service face the crawler reads (narrowed). */
export interface HostSettingsFace {
  describe(options?: { redactSecrets?: boolean }): HostSettingsDescriptor[]
}

/** The invariants service face the companion registers into (narrowed). */
export interface HostInvariantsFace {
  register(packageName: string, installer: unknown): () => void
}

declare module 'cordis' {
  interface Context {
    /** The settings service, provided by the composed DSH profile. */
    settings: HostSettingsFace
    /** The invariants service, provided by the composed DSH profile. */
    invariants: HostInvariantsFace
  }
}

/** Re-export the module-augmented Context for explicit typing where needed. */
export type { Context }
