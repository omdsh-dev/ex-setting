import { clientBundle } from './tsdown.client.config.ts'

/**
 * Emit the closure-factory runtime after the declaration build has completed.
 * The package build invokes this config as a second process so the ESM
 * declaration pass cannot overwrite `lib/client.js`.
 */
export default clientBundle('src/client/index.ts', 'tsconfig.client.json')
