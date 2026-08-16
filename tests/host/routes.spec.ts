/**
 * Crawler composition route contract: the exact webserver route serves the
 * redacted enumeration, applies path edits, rejects malformed bodies and
 * refused edits loud, answers 405 for other methods, and disposes with the
 * fiber. The route registers only when the webserver capability is present.
 */

import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { CompositionConfigView, WebConfigCrawler } from '../../src/index.ts'
import { COMPOSITION_ROUTE, registerCompositionRoute } from '../../src/routes.ts'

/** One captured webserver registration. */
interface CapturedRoute {
  route: {
    kind: 'exact'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void
  }
  dispose: ReturnType<typeof vi.fn>
}

/** A webserver face that records the single registered route. */
function fakeWebServer(): { register: ReturnType<typeof vi.fn>; captured: CapturedRoute | undefined } {
  let captured: CapturedRoute | undefined
  const register = vi.fn((route: CapturedRoute['route']) => {
    const dispose = vi.fn()
    captured = { route, dispose }
    return dispose
  })
  return { register, get captured() { return captured } }
}

/** A fake response recording status and body. */
function fakeRes(): ServerResponse & { status: number; body: string } {
  const res = {
    status: 0,
    body: '',
    writeHead: vi.fn((status: number) => { res.status = status }),
    end: vi.fn((body: string) => { res.body = body }),
  }
  return res as never
}

/** A fake request emitting its body then the end event. */
function fakeReq(method: string, body = ''): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage
  req.method = method
  queueMicrotask(() => {
    if (body.length > 0) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

/** A crawler face with spy edit methods and one fixed enumeration. */
function crawlerOf(): { crawler: WebConfigCrawler; update: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } {
  const view: CompositionConfigView = { id: 'session', schema: {}, value: { retries: 3 }, secrets: [] }
  const update = vi.fn(async () => view)
  const remove = vi.fn(async () => {})
  return {
    crawler: {
      namespaces: () => ['session', 'llm-pi-ai'] as never,
      compositionConfigs: () => [view],
      updateComposition: update,
      removeComposition: remove,
    },
    update,
    remove,
  }
}

describe('registerCompositionRoute', () => {
  it('registers nothing without the webserver capability', () => {
    const ctx = new Context()
    expect(registerCompositionRoute(ctx, crawlerOf().crawler)).toBeUndefined()
  })

  it('serves the redacted enumeration on GET with a fiber-owned disposer', async () => {
    const server = fakeWebServer()
    const ctx = new Context()
    ctx.provide('webServer', { register: server.register } as never)
    const dispose = registerCompositionRoute(ctx, crawlerOf().crawler)
    expect(server.captured).toBeDefined()
    expect(server.captured!.route.kind).toBe('exact')
    expect(server.captured!.route.path).toBe(COMPOSITION_ROUTE)

    const res = fakeRes()
    server.captured!.route.handler(fakeReq('GET'), res)
    await Promise.resolve()
    expect(res.status).toBe(200)
    const body = JSON.parse(res.body) as { namespaces: string[]; composition: unknown }
    expect(body.namespaces).toEqual(['session', 'llm-pi-ai'])
    expect(body.composition).toEqual([{ id: 'session', schema: {}, value: { retries: 3 }, secrets: [] }])

    dispose?.()
    expect(server.captured!.dispose).toHaveBeenCalled()
    dispose?.()
    expect(server.captured!.dispose).toHaveBeenCalledTimes(2)
  })

  it('applies an update edit and returns the committed view', async () => {
    const server = fakeWebServer()
    const ctx = new Context()
    ctx.provide('webServer', { register: server.register } as never)
    const { crawler, update } = crawlerOf()
    registerCompositionRoute(ctx, crawler)

    const res = fakeRes()
    server.captured!.route.handler(
      fakeReq('POST', JSON.stringify({
        op: 'update', id: 'session', ops: [{ op: 'set', path: ['retries'], value: 4 }],
      })),
      res,
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(update).toHaveBeenCalledWith('session', [{ op: 'set', path: ['retries'], value: 4 }])
    expect(res.status).toBe(200)
    expect(JSON.parse(res.body) as unknown).toEqual({ id: 'session', schema: {}, value: { retries: 3 }, secrets: [] })
  })

  it('applies a remove edit', async () => {
    const server = fakeWebServer()
    const ctx = new Context()
    ctx.provide('webServer', { register: server.register } as never)
    const { crawler, remove } = crawlerOf()
    registerCompositionRoute(ctx, crawler)

    const res = fakeRes()
    server.captured!.route.handler(fakeReq('POST', JSON.stringify({ op: 'remove', id: 'session' })), res)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(remove).toHaveBeenCalledWith('session')
    expect(res.status).toBe(200)
    expect(res.body).toBe('{}')
  })

  it('rejects malformed bodies and refused edits loud', async () => {
    const server = fakeWebServer()
    const ctx = new Context()
    ctx.provide('webServer', { register: server.register } as never)
    const { crawler, update } = crawlerOf()
    update.mockRejectedValueOnce(new Error('row is not mounted'))
    registerCompositionRoute(ctx, crawler)

    const malformed = fakeRes()
    server.captured!.route.handler(fakeReq('POST', '{not json'), malformed)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(malformed.status).toBe(400)
    expect((JSON.parse(malformed.body) as { code: string }).code).toBe('composition-rejected')

    const refused = fakeRes()
    server.captured!.route.handler(
      fakeReq('POST', JSON.stringify({ op: 'update', id: 'ghost', ops: [] })),
      refused,
    )
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(refused.status).toBe(400)
    expect((JSON.parse(refused.body) as { message: string }).message).toBe('row is not mounted')
  })

  it('answers 405 for every method besides GET and POST', () => {
    const server = fakeWebServer()
    const ctx = new Context()
    ctx.provide('webServer', { register: server.register } as never)
    registerCompositionRoute(ctx, crawlerOf().crawler)

    const res = fakeRes()
    server.captured!.route.handler(fakeReq('DELETE'), res)
    expect(res.status).toBe(405)
  })
})
