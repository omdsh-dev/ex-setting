import { describe, expect, it } from 'vitest'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import * as crawler from '../../src/index.ts'

describe('web-config-crawler Loader export', () => {
  it('retains the function-plugin namespace without a default export', () => {
    expect('default' in crawler).toBe(false)
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped = loader.unwrapExports(crawler) as Record<string, unknown>
    expect(unwrapped).toBe(crawler)
    expect(unwrapped.name).toBe('web-config-crawler')
    expect(unwrapped.inject).toEqual(['settings'])
    expect(unwrapped.Config).toBeDefined()
    expect(typeof unwrapped.apply).toBe('function')
  })
})
