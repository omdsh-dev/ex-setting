import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dsh = (path: string): string => fileURLToPath(new URL(`../deepseek-harness/${path}`, import.meta.url))

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@deepseek-ai/dsh-client-connection/client': dsh('packages/client/connection/src/client/index.ts'),
      '@deepseek-ai/dsh-client-runtime/client': dsh('packages/client/runtime/src/client/index.ts'),
      '@deepseek-ai/dsh-client-locale/client': dsh('packages/client/locale/src/client/index.ts'),
      '@deepseek-ai/dsh-client-ui-slots': dsh('packages/client/ui-slots/src/index.ts'),
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./tests/fixtures/ui-primitives.ts', import.meta.url)),
      '@deepseek-ai/dsh-client-test-runtime': dsh('packages/client/test-runtime/src/locale-env.ts'),
      '@deepseek-ai/dsh-ex-setting/client': fileURLToPath(new URL('./src/client/index.ts', import.meta.url)),
      '@deepseek-ai/dsh-ex-setting/src/*': fileURLToPath(new URL('./src/', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
})
