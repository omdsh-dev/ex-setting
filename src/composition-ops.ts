import type { CompositionPathOp } from './composition-contract.ts'

/** Apply ordered composition edits without mutating the resolved row value. */
export function applyCompositionOps(value: unknown, ops: readonly CompositionPathOp[]): unknown {
  let next = structuredClone(value)
  for (const op of ops) {
    next = op.op === 'set'
      ? setAt(next, op.path, op.value)
      : op.path.length === 0 ? undefined : unsetAt(next, op.path)
  }
  return next
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
  // The public operation handler handles an empty path before calling here.
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
