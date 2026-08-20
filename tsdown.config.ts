import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.config.ts'

/**
 * Build the host and browser declaration faces directly from `src/`. The
 * closure-factory browser runtime is emitted by the second, sequential
 * `tsdown.client.runtime.config.ts` invocation in the package build script;
 * keeping it out of this config prevents the declaration build from racing
 * with and overwriting `lib/client.js`. TypeScript is used only for the
 * separate no-emit typecheck script.
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
