import { describe, expect, it } from 'vitest'
import { CLIENT_EXTERNALS } from '../../tsdown.client.config.ts'

describe('client bundle externals', () => {
  it('inlines schema-form helpers instead of requiring a missing module-table row', () => {
    expect(CLIENT_EXTERNALS).not.toContain('@deepseek-ai/dsh-client-schema-form')
  })
})
