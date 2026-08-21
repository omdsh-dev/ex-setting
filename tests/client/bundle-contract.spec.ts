import { describe, expect, it } from 'vitest'
import { CLIENT_EXTERNALS } from '../../tsdown.client.config.ts'

describe('client bundle externals', () => {
  it('keeps only shell-seeded value imports external', () => {
    expect(CLIENT_EXTERNALS).toEqual(['react', 'react/jsx-runtime'])
  })

  it('inlines schema-form helpers instead of requiring a missing module-table row', () => {
    expect(CLIENT_EXTERNALS).not.toContain('@deepseek-ai/dsh-client-schema-form')
  })
})
