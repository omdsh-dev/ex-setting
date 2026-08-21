/**
 * Local test doubles mirroring the two faces the client specs use from the
 * registry test-support package. The Stent pattern keeps node-side specs
 * free of packages whose root modules re-export closure-factory /client
 * bundles (which carry no ESM exports), so the tiny contract surfaces the
 * specs actually exercise live here instead.
 */
import { afterEach, beforeEach } from 'vitest'

/** Pin navigator.languages/language for the whole suite (the test-support contract). */
export function usePinnedBrowserLanguages(primary: string, ...rest: string[]): void {
  beforeEach(() => {
    Object.defineProperty(navigator, 'languages', { value: [primary, ...rest], configurable: true })
    Object.defineProperty(navigator, 'language', { value: primary, configurable: true })
  })
  afterEach(() => {
    const own = navigator
    delete own.languages
    delete own.language
  })
}

/** Forwarded-host-event double standing in for the connection sink's carrier. */
export class TestRemote {
  private readonly subscriptions = new Map<string, Set<(...args: unknown[]) => void>>()

  /** Register the double as `ctx.remote`. */
  constructor(ctx: { provide: (name: 'remote', value: unknown) => void }) {
    ctx.provide('remote', this)
  }

  /** Deliver one forwarded host event to its subscribers. */
  $dispatch(event: string, args: unknown[]): void {
    const listeners = this.subscriptions.get(event)
    if (listeners === undefined) return
    for (const listener of [...listeners]) listener(...args)
  }

  /** Subscribe to one forwarded host event; returns a disposer. */
  $on(event: string, listener: (...args: unknown[]) => void): () => void {
    const listeners = this.subscriptions.get(event) ?? new Set()
    this.subscriptions.set(event, listeners)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  /** Generated-namespace mount, unsupported by this double. */
  $mount(): Promise<never> {
    return Promise.reject(new Error('TestRemote: $mount needs the real Client Remote service'))
  }
}
