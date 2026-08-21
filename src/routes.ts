/**
 * Crawler-owned composition wire: the browser half reads and edits
 * composition rows through this exact webserver route instead of an apiproxy
 * RPC domain, so the crawler adds its write path without changing the
 * gateway. The route mounts only when the webserver capability is present
 * (non-web compositions skip it); the settings namespace read stays on the
 * gateway's `settings.describe` RPC, which already serves registered
 * namespaces.
 *
 * The route is registered as a fiber effect and answers:
 * - GET: the full redacted enumeration (`namespaces` + `composition`), the
 *   same payload shape the previous gateway domain served;
 * - POST: one path-addressed edit (`update` / `remove`) persisted into the
 *   personal overlay;
 * - any other method: 405.
 * @module @deepseek-ai/dsh-ex-setting/routes
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {
  CompositionConfigView, CompositionPathOp, CompositionRequest,
} from './composition-contract.ts'
import type { WebConfigCrawler } from './index.ts'

/** Exact route path the browser half fetches (same-origin). */
export const COMPOSITION_ROUTE = '/dsh-config/crawler/composition'

/** The webserver face this module consumes, narrowed structurally (no package dependency). */
interface WebServerLike {
  register(route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void
  }): () => void
}

/** Maximum accepted request body: composition edits are tiny (64 KiB). */
const MAX_BODY_BYTES = 64 * 1024

/** Serialize a JSON response with the standard content type. */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Collect the request body with a size cap; oversized bodies reject once. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    let settled = false
    const chunks: Buffer[] = []
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        fail(new Error('web-config-crawler: composition request body too large'))
        req.destroy?.()
        return
      }
      chunks.push(chunk)
    })
    req.on('error', (error: Error) => { fail(error) })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Narrow one wire path to the string segments consumed by the host editor. */
function parsePath(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(segment => typeof segment !== 'string')) {
    throw new Error('web-config-crawler: composition op.path must be an array of strings')
  }
  return [...value]
}

/** Narrow the path operations accepted by the composition route. */
function parseOps(value: unknown): CompositionPathOp[] {
  if (!Array.isArray(value)) {
    throw new Error('web-config-crawler: body.ops must be an array of path ops')
  }
  return value.map((candidate) => {
    if (!isRecord(candidate) || (candidate.op !== 'set' && candidate.op !== 'unset')) {
      throw new Error('web-config-crawler: each composition op must use "set" or "unset"')
    }
    const path = parsePath(candidate.path)
    if (candidate.op === 'set') {
      if (!Object.prototype.hasOwnProperty.call(candidate, 'value')) {
        throw new Error('web-config-crawler: set operations must include value')
      }
      return { op: 'set', path, value: candidate.value }
    }
    return { op: 'unset', path }
  })
}

/** Narrow an unknown parsed JSON value to a composition request. */
function parseRequest(value: unknown): CompositionRequest {
  if (!isRecord(value)) {
    throw new Error('web-config-crawler: expected a JSON object body')
  }
  const op = value.op
  if (op !== 'update' && op !== 'remove') {
    throw new Error('web-config-crawler: body.op must be "update" or "remove"')
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error('web-config-crawler: body.id must be a non-empty string')
  }
  if (op === 'remove') return { op, id: value.id }
  return { op, id: value.id, ops: parseOps(value.ops) }
}

/** Respond with the route's stable rejection envelope. */
function compositionError(res: ServerResponse, error: unknown): void {
  json(res, 400, {
    code: 'composition-rejected',
    message: error instanceof Error ? error.message : String(error),
  })
}

/**
 * Register the crawler composition route on the webserver, if present.
 * @param ctx - host context; the webserver capability is optional.
 * @param crawler - the live crawler face serving the enumeration and edits.
 * @returns the route disposer, or undefined when no webserver is mounted.
 */
export function registerCompositionRoute(ctx: Context, crawler: WebConfigCrawler): (() => void) | undefined {
  const server = ctx.get('webServer') as WebServerLike | undefined
  if (server === undefined) return undefined
  let removeRoute: (() => void) | undefined
  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    const respond = (status: number, body: unknown): void => { json(res, status, body) }
    if (req.method === 'GET' || req.method === 'HEAD') {
      respond(200, {
        namespaces: crawler.namespaces().map(String),
        composition: crawler.compositionConfigs(),
      })
      return
    }
    if (req.method !== 'POST') {
      respond(405, { code: 'method-not-allowed', message: 'only GET and POST are served' })
      return
    }
    void readBody(req).then(async (text) => {
      try {
        const request = parseRequest(JSON.parse(text))
        if (request.op === 'update') {
          const view: CompositionConfigView = await crawler.updateComposition(request.id, request.ops)
          respond(200, view)
        } else {
          await crawler.removeComposition(request.id)
          respond(200, {})
        }
      } catch (error) {
        compositionError(res, error)
      }
    }).catch((error: unknown) => {
      compositionError(res, error)
    })
  }
  const route = { kind: 'exact' as const, path: COMPOSITION_ROUTE, handler }
  ctx.effect(() => {
    removeRoute = server.register(route)
    return () => { removeRoute?.() }
  }, `web-config-crawler: ${COMPOSITION_ROUTE}`)
  return () => { removeRoute?.() }
}
