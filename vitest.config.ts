import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    environment: 'node',
    server: {
      deps: {
        // Inline the primitives package so its CSS imports go through the
        // transform pipeline. Everything else resolves from the registry
        // install like production does; the /client closure bundles are
        // materialized by the tests themselves (tests/client-bundles).
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
})
