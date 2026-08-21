/**
 * Host/client wire types for the crawler-owned composition editor.
 *
 * This module contains types only so both build faces can import the same
 * response and request vocabulary without pulling host or browser runtime code
 * into the other bundle.
 */

/** One mounted plugin's composition configuration, redacted for the wire. */
export interface CompositionConfigView {
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
export type CompositionPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** One request accepted by the crawler composition route. */
export type CompositionRequest =
  | { op: 'update'; id: string; ops: CompositionPathOp[] }
  | { op: 'remove'; id: string }
