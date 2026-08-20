/**
 * Web configuration crawler. While this plugin is mounted, the host gateway
 * serves EVERY registered settings namespace to the Web client — no
 * per-plugin opt-in required — and exposes every mounted plugin's
 * composition `Config` (the cordis.yml row configuration) as a
 * restart-required surface persisted into the personal `$DSH_HOME/config.yaml`
 * overlay. Mounting it is the deployment's explicit decision to expose
 * composition-row configuration and the crawler-owned editing route over the
 * loopback-only configuration plane; without it, the gateway still serves
 * registered settings namespaces but no composition editor is mounted.
 *
 * The host gateway already serves every registered settings namespace. This
 * plugin owns the live crawler and composition editor; Fabric remains an
 * optional runtime capability for the browser bundle rewrite below, not a
 * patch dependency for the gateway's settings exposure.
 * @module @deepseek-ai/dsh-ex-setting
 */

import { readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import { redactSecrets } from '@deepseek-ai/dsh-settings'
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { registerCompositionRoute } from './routes.ts'
import { NAV_SCROLL_ROUTE, navScrollPatch } from './nav-scroll.ts'
import { FabricCompatService } from '@oh-my-dsh/cordis-fabric-api'
import { load as loadYaml, dump as dumpYaml } from 'js-yaml'
// Side-effect type import: the loader augments cordis's Fiber with `entry`
// (the composition row behind each runtime fiber).
import type {} from '@deepseek-ai/cordis-plugin-loader'

/** One mounted plugin's composition configuration, redacted for the wire. */
export interface CompositionConfigView {
  /** The composition row id this config belongs to (`llm-deepseek`, `session`, …). */
  id: string
  /** Optional display name from the plugin shape. */
  name?: string
  /** Serialized schemastery schema envelope (`Config.toJSON()`). */
  schema: unknown
  /** Redacted resolved configuration (row config after defaulting). */
  value: unknown
  /** Redacted secret positions inside the resolved value. */
  secrets: Array<{ path: string[]; set: boolean }>
}

/** One path-addressed composition edit, mirroring the settings wire ops. */
export type CompositionPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** The live auto-crawl face the host gateway consults. */
export interface WebConfigCrawler {
  /**
   * Every settings namespace currently registered, resolved at call time so
   * registrations that mount or dispose between requests are reflected
   * immediately.
   * @returns the branded namespace ids in registration order.
   */
  namespaces(): SettingsNamespace[]
  /**
   * Every mounted plugin whose composition row carries a `Config` schema,
   * redacted for the wire. Resolved at call time from the runtime registry.
   * @returns composition configuration views in registration order.
   */
  compositionConfigs(): CompositionConfigView[]
  /**
   * Apply path-addressed edits to one mounted plugin's resolved composition
   * configuration and persist the full row into the personal overlay.
   * @param id - the composition row id.
   * @param ops - ordered path edits against the CURRENT resolved configuration.
   * @param signal - optional caller lifetime for the file write.
   * @returns the fresh redacted view, or throws for unknown/unwritable rows.
   */
  updateComposition(id: string, ops: CompositionPathOp[]): Promise<CompositionConfigView>
  /**
   * Remove one mounted plugin's row from the personal overlay, reverting it
   * to the lower composition layers on the next boot.
   * @param id - the composition row id.
   */
  removeComposition(id: string): Promise<void>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The live auto-crawl face; absent until the crawler plugin mounts. */
    webConfigCrawler?: WebConfigCrawler
  }
}

/** Cordis plugin identity (function-plugin export shape). */
export const name = 'web-config-crawler'

/** Required services (cordis fiber inject). */
export const inject = ['settings']

/** Deployment-level configuration of the crawler itself. */
export interface Config {
  /**
   * The personal overlay file composition rows are persisted into; defaults
   * to `$DSH_HOME/config.yaml`, the personal layer every surface applies.
   */
  overlayPath?: string
}

export const Config: z<Config> = z.object({
  overlayPath: z.string().default(join(dshHomePath(), 'config.yaml')),
})

/** Whether a filesystem error means absence; every non-ENOENT failure must surface. */
function isENOENT(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT'
}

/** Narrow an overlay row to its id-bearing object shape. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The registry entry for one composed row: schema, resolved value, row id. */
interface RowFacts {
  id: string
  name?: string
  schema: z<unknown>
  value: unknown
}

/** The live loader entry surface the crawl reads (registry cordis has no fiber→entry link). */
interface LoaderEntryLike {
  options?: { id?: unknown }
  fiber?: { config?: unknown; runtime?: { name?: unknown; Config?: unknown } } | null
}

/**
 * Enumerate every mounted plugin that carries a `Config` schema and a
 * composition row id, from the live loader entries (each entry knows its
 * fiber, the fiber its validated config and runtime schema).
 * @param ctx - host context.
 * @returns row facts in loader order.
 */
function rowFacts(ctx: Context): RowFacts[] {
  const rows: RowFacts[] = []
  const entries = (ctx as unknown as { loader?: { entries?: () => Iterable<LoaderEntryLike> } }).loader?.entries?.() ?? []
  for (const entry of entries) {
    const id = entry.options?.id
    if (typeof id !== 'string') continue
    const fiber = entry.fiber
    if (fiber === undefined || fiber === null) continue
    const schema = fiber.runtime?.Config as z<unknown> | undefined
    // Only schemastery Configs are schema-renderable: the redaction walker
    // and the editor rehydrate from `toJSON()` envelopes, which native zod
    // schemas lack. A native-zod row stays composition-configurable through
    // its file, just not through the generic Web editor.
    if (schema === undefined || typeof schema['toJSON'] !== 'function') continue
    rows.push({
      id,
      ...typeof fiber.runtime?.name === 'string' ? { name: fiber.runtime.name } : {},
      schema,
      value: fiber.config,
    })
  }
  return rows
}

/** Read the personal overlay as an entry list; `[]` when absent. */
async function readOverlay(path: string): Promise<unknown[]> {
  try {
    const text = await readFile(path, 'utf8')
    const doc: unknown = loadYaml(text)
    return Array.isArray(doc) ? doc as unknown[] : []
  } catch (error) {
    if (isENOENT(error)) return []
    throw error
  }
}

/**
 * Provide the crawler service (the settings registry, the composition
 * registry, and the overlay write path), then mount the compat facade for the
 * browser bundle rewrite.
 * @param ctx - host context with the settings seam mounted.
 * @param config - resolved crawler configuration.
 */
export async function apply(ctx: Context, config?: Config): Promise<void> {
  const overlayPath = config?.overlayPath ?? join(dshHomePath(), 'config.yaml')
  const crawler: WebConfigCrawler = {
    namespaces: () => ctx.settings.describe({ redactSecrets: true }).map(descriptor => descriptor.ns),

    compositionConfigs: () => rowFacts(ctx).map((row) => {
      // The seam's walker is typed over the schema it redacts; the registry
      // hands us the same schemastery shape the seam stores.
      const redacted = redactSecrets(row.schema as z<never>, row.value)
      return {
        id: row.id,
        ...row.name === undefined ? {} : { name: row.name },
        schema: row.schema.toJSON(),
        value: redacted.value,
        secrets: redacted.secrets,
      }
    }),

    async updateComposition(id, ops) {
      const row = rowFacts(ctx).find(candidate => candidate.id === id)
      if (row === undefined) throw new Error(`composition row "${id}" is not a mounted schema-carrying plugin`)
      let next = structuredClone(row.value)
      for (const op of ops) {
        next = op.op === 'set'
          ? setAt(next, op.path, op.value)
          : op.path.length === 0 ? undefined : unsetAt(next, op.path)
      }
      const [resolved] = z.resolve(next, row.schema, {}) as [unknown]
      const rows = await readOverlay(overlayPath)
      const index = rows.findIndex(entry => isRecord(entry) && entry.id === id)
      const rowEntry: Record<string, unknown> = { id, config: resolved }
      if (index >= 0) rows[index] = rowEntry
      else rows.push(rowEntry)
      await writeOverlay(overlayPath, rows)
      const redacted = redactSecrets(row.schema as z<never>, resolved)
      return {
        id,
        ...row.name === undefined ? {} : { name: row.name },
        schema: row.schema.toJSON(),
        value: redacted.value,
        secrets: redacted.secrets,
      }
    },

    async removeComposition(id) {
      const rows = await readOverlay(overlayPath)
      const index = rows.findIndex(entry => isRecord(entry) && entry.id === id)
      if (index < 0) return
      rows.splice(index, 1)
      await writeOverlay(overlayPath, rows)
    },
  }
  ctx.provide('webConfigCrawler', crawler)
  registerCompositionRoute(ctx, crawler)
  await ctx.plugin(FabricCompatService, {})
  const compat = ctx.get('fabricCompat')
  /* v8 ignore next -- ctx.plugin(FabricCompatService) resolves it or rejects before returning. */
  if (compat === undefined) throw new Error('web-config-crawler: fabricCompat unavailable after mounting')
  // The browser half injects the settings-navigation scroll styles through a
  // `before` handler on the transformed ui-settings-general bundle. The
  // runtime serving primitive resolves the target package through the Loader
  // composition anchor. Direct non-Loader mounts can provide the crawler
  // without either optional web capability, so skip this seam unless both
  // prerequisites are present.
  if (ctx.get('webServer') !== undefined && ctx.baseUrl !== undefined) {
    compat.serveBundle({
      route: NAV_SCROLL_ROUTE,
      patch: navScrollPatch,
      // The app must keep working if the transform cannot run: the dialog
      // then shows the full catalog without scrolling (degraded).
      fallback: 'raw',
    })
  }
}

/** Immutably set a path in a JSON-shaped value, materializing containers. */
function setAt(value: unknown, path: readonly string[], next: unknown): unknown {
  const head = path[0]
  if (head === undefined) return next
  const rest = path.slice(1)
  const container = typeof value === 'object' && value !== null
    ? structuredClone(value) as Record<string, unknown>
    : {}
  if (/^(0|[1-9][0-9]*)$/.test(head) && Array.isArray(value)) {
    const list = structuredClone(value) as unknown[]
    list[Number(head)] = setAt(list[Number(head)], rest, next)
    return list
  }
  container[head] = setAt(container[head], rest, next)
  return container
}

/** Immutably unset a path in a JSON-shaped value. */
function unsetAt(value: unknown, path: readonly string[]): unknown {
  const head = path[0]
  // updateComposition routes the empty path to the row-removal branch before
  // calling here, and every recursive call passes a non-empty remainder.
  /* v8 ignore next -- the empty-path arm is unreachable by construction */
  if (head === undefined) return value
  const rest = path.slice(1)
  if (Array.isArray(value) && /^(0|[1-9][0-9]*)$/.test(head)) {
    const list = structuredClone(value) as unknown[]
    if (rest.length === 0) list.splice(Number(head), 1)
    else list[Number(head)] = unsetAt(list[Number(head)], rest)
    return list
  }
  if (typeof value !== 'object' || value === null) return value
  const container = structuredClone(value) as Record<string, unknown>
  if (rest.length === 0) {
    const { [head]: _removed, ...remainder } = container
    return remainder
  }
  container[head] = unsetAt(container[head], rest)
  return container
}

/** Write the overlay entry list back to the personal config file. */
async function writeOverlay(path: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) {
    // An emptied overlay is an absent overlay: the loader chain treats a
    // missing personal config as no layer.
    await rm(path, { force: true })
    return
  }
  await writeFile(path, dumpYaml(rows, { noRefs: true }), 'utf8')
}
