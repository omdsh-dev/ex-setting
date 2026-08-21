import { describe, expect, it, vi } from 'vitest'
import { crawlerCompositionApi } from '../../src/client/crawler-api.ts'

describe('crawlerCompositionApi', () => {
  it('degrades unreachable descriptions to an empty composition list', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'))
    await expect(crawlerCompositionApi('/crawler', fetchImpl).describe()).resolves.toEqual([])
  })

  it('passes abort signals through update and remove requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'session' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const api = crawlerCompositionApi('/crawler', fetchImpl)
    const signal = new AbortController().signal

    await api.update('session', [{ op: 'set', path: ['enabled'], value: true }], signal)
    await api.remove('session', signal)

    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/crawler', expect.objectContaining({ signal }))
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/crawler', expect.objectContaining({ signal }))
  })

  it('surfaces a server rejection message for writes', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ message: 'row is read-only' }), { status: 400 }),
    )
    await expect(crawlerCompositionApi('/crawler', fetchImpl).remove('session'))
      .rejects.toThrow('row is read-only')
  })
})
