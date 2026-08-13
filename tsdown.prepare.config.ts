import { defineConfig } from 'tsdown'

/**
 * Consumer-side runtime bundle for Git and tarball installs. Bundles source
 * directly (no repository project references); host-provided packages
 * (@deepseek-ai/dsh-*) stay external and resolve at runtime from the DSH
 * installation, exactly as the package's peerDependencies declare.
 */
export default defineConfig([
  {
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
  },
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    tsconfig: 'tsconfig.prepare.json',
  },
])
