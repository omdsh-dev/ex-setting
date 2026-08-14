import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.config.ts'

/**
 * Consumer-side runtime bundle for Git and tarball installs. Bundles source
 * directly (no repository project references); host-provided packages
 * (@deepseek-ai/dsh-*) stay external and resolve at runtime from the DSH
 * installation, exactly as the package's peerDependencies declare. The
 * browser half ships in the closure-factory artifact (see
 * tsdown.client.config.ts).
 */
export default defineConfig([
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
    dts: false,
    clean: true,
    tsconfig: 'tsconfig.prepare.json',
  }),
  clientBundle('src/client/index.ts', 'tsconfig.prepare.json'),
])
