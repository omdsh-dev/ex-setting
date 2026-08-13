import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dsh = (path: string): string => fileURLToPath(new URL(`../deepseek-harness/${path}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/cordis': dsh('vendor/cordis/src/index.ts'),
      '@deepseek-ai/schemastery': dsh('vendor/schemastery/src/index.ts'),
      '@deepseek-ai/cordis-plugin-loader': dsh('vendor/loader/src/index.ts'),
      '@deepseek-ai/cordis-plugin-include': dsh('vendor/include/src/index.ts'),
      '@deepseek-ai/dsh-api-remotes/client': dsh('packages/api/remotes/src/client/index.ts'),
      '@deepseek-ai/dsh-client-connection/client': dsh('packages/client/connection/src/client/index.ts'),
      '@deepseek-ai/dsh-client-locale/client': dsh('packages/client/locale/src/client/index.ts'),
      '@deepseek-ai/dsh-client-runtime/client': dsh('packages/client/runtime/src/client/index.ts'),
      '@deepseek-ai/dsh-client-schema-form': dsh('packages/client/schema-form/src/index.ts'),
      '@deepseek-ai/dsh-client-ui-settings/client': dsh('packages/client/ui-settings/src/client/index.ts'),
      '@deepseek-ai/dsh-client-ui-slots': dsh('packages/client/ui-slots/src/index.ts'),
      '@deepseek-ai/dsh-client-ui-primitives': fileURLToPath(new URL('./tests/fixtures/ui-primitives.ts', import.meta.url)),
      '@deepseek-ai/dsh-client-test-runtime': dsh('packages/test-support/client-runtime/src/index.ts'),
      '@deepseek-ai/dsh-home-paths': dsh('packages/util/home-paths/src/index.ts'),
      '@deepseek-ai/dsh-invariants': dsh('packages/runtime-diagnostics/invariants/src/index.ts'),
      '@deepseek-ai/dsh-settings': dsh('packages/settings/settings/src/index.ts'),
      '@deepseek-ai/dsh-settings-file': dsh('packages/settings/settings-file/src/index.ts'),
      '@deepseek-ai/dsh-host-apiproxy/api': dsh('packages/host/apiproxy/src/api/index.ts'),
      '@deepseek-ai/dsh-host-apiproxy': dsh('packages/host/apiproxy/src/index.ts'),
      '@deepseek-ai/dsh-ex-setting/client': fileURLToPath(new URL('./src/client/index.ts', import.meta.url)),
      '@deepseek-ai/dsh-ex-setting/src/*': fileURLToPath(new URL('./src/', import.meta.url)),
      '@deepseek-ai/dsh-ex-setting': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
  },
})
