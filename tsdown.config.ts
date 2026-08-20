import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.config.ts'

/**
 * Build the host and browser faces directly from `src/`. Declarations are
 * emitted by tsdown alongside the runtime entries; TypeScript is used only for
 * the separate no-emit typecheck script.
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
  clientBundle('src/client/index.ts', 'tsconfig.client.json'),
]
