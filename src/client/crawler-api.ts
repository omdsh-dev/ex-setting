/**
 * Browser-side crawler wire: the composition read/edit face over the
 * crawler's own webserver route, with local types that mirror the host
 * crawler's `CompositionConfigView` / `CompositionPathOp` (the connection
 * package carries no composition domain — the crawler owns its write path).
 *
 * `describe` degrades to an empty list when the route is unreachable (the
 * crawler row disabled, or a non-web composition): the settings namespaces
 * from `settings.describe` keep the dialog usable without composition rows.
 * `update` / `remove` fail loud with the host's rejection message.
 */

/** One mounted plugin's composition configuration, redacted for the wire. */
export interface CompositionNamespaceView {
  /** The composition row id this config belongs to. */
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
export type CompositionPathOpView =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** The crawler composition face the settings dialog consumes. */
export interface CrawlerCompositionApi {
  /** Redacted composition rows in row order; an unreachable route yields []. */
  describe(): Promise<CompositionNamespaceView[]>
  /** Apply path edits and persist the row into the personal overlay. */
  update(id: string, ops: CompositionPathOpView[]): Promise<CompositionNamespaceView>
  /** Remove the row from the personal overlay, reverting to lower layers. */
  remove(id: string): Promise<void>
}

/** Exact route path the crawler host registers (see its routes module). */
export const CRAWLER_COMPOSITION_ROUTE = '/dsh-config/crawler/composition'

/** Normalize a rejected response body into a message naming the failure. */
async function responseError(response: Response): Promise<Error> {
  let detail = ''
  try {
    const body = await response.json() as { message?: unknown }
    if (typeof body.message === 'string') detail = body.message
  } catch {
    // A non-JSON error body keeps the status-based message below.
  }
  return new Error(detail.length > 0 ? detail : `crawler composition ${response.status}`)
}

/**
 * Build the crawler composition face over the crawler's route.
 * @param route - the crawler route path; defaults to the shared constant.
 * @param fetchImpl - fetch implementation; defaults to the global fetch.
 * @returns the crawler composition api.
 */
export function crawlerCompositionApi(
  route: string = CRAWLER_COMPOSITION_ROUTE,
  fetchImpl: typeof fetch = fetch,
): CrawlerCompositionApi {
  const send = (body: unknown): Promise<Response> => fetchImpl(route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    async describe() {
      try {
        const response = await fetchImpl(route)
        if (!response.ok) return []
        const body = await response.json() as { composition?: unknown }
        return Array.isArray(body.composition) ? body.composition as CompositionNamespaceView[] : []
      } catch {
        // The crawler is optional in a deployment; an unreachable route is an
        // empty composition, never a catalog failure.
        return []
      }
    },

    async update(id, ops) {
      const response = await send({ op: 'update', id, ops })
      if (!response.ok) throw await responseError(response)
      return await response.json() as CompositionNamespaceView
    },

    async remove(id) {
      const response = await send({ op: 'remove', id })
      if (!response.ok) throw await responseError(response)
    },
  }
}
