import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.config.ts'

/**
 * Build the host and browser declaration faces directly from `src/`. The
 * browser declaration pass writes into `lib/.client-dts`; the package build
 * promotes only its declaration files before the sequential closure runtime
 * pass writes `lib/client.js`. Keeping the runtime pass separate prevents a
 * declaration build from ever leaving a plain ESM client artifact at the
 * published path. TypeScript is used only for the separate no-emit typecheck
 * script.
 */
export default [
  defineConfig({
    entry: {
      index: 'src/index.ts',
      invariant: 'src/invariant.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: true,
    clean: true,
    deps: { dts: { neverBundle: true } },
    tsconfig: 'tsconfig.host.json',
  }),
  clientBundle('src/client/index.ts', 'tsconfig.client.json', true),
]
