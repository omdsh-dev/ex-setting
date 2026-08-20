/**
 * Real Node loader guard for the crawler's exposure widening. Vitest's own
 * transform would bypass Fabric's module hooks, so the child runs through the
 * Fabric test kit: it bootstraps the static stub exactly as the web roster's
 * `cordis-fabric` row carries it, then imports the real gateway and the real
 * crawler and asserts the plugin-only namespace is served only after the
 * crawler mounts — the full-enumeration contract the gateway's allowlist
 * stance needs the Fabric patch to deliver.
 */

import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { FabricPatchStub } from 'cordis-fabric'
import { runPatchFixture } from 'cordis-fabric/testing/testkit'

/** The fixture entry, as an absolute file URL the child can import. */
const entry = new URL('./fixtures/check-fabric.ts', import.meta.url).href

/** Repository root: the child resolves tsx and workspace packages from here. */
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** The static stub, shaped exactly like the web roster's config.fabric.patches entry. */
const patches: FabricPatchStub[] = [
  {
    id: 'web-config-crawler/exposed-namespaces',
    target: {
      module: '@deepseek-ai/dsh-host-apiproxy',
      versionRange: '>=0.0.1-0',
      filePaths: ['src/api-proxy.ts', 'lib/index.js'],
      functionQuery: { functionName: 'exposedNamespaces', kind: 'Sync' },
    },
    operation: 'after',
  },
]

describe('web-config-crawler Fabric composition', () => {
  it('serves every registered namespace through the exposure patch once mounted', () => {
    // tsx resolves host-provided packages through this repository's tsconfig
    // paths only when told which config to read (it does not auto-discover
    // the root aggregate). The testkit child inherits process.env.
    process.env.TSX_TSCONFIG_PATH = fileURLToPath(new URL('../../tsconfig.json', import.meta.url))
    const outcome = runPatchFixture({ cwd: repoRoot, patches, entry })
    expect(outcome.exitCode).toBe(0)
    expect(outcome.error).toBeUndefined()
    expect(outcome.result).toEqual({
      // The allowlist-only gateway refuses the plugin-only namespace; the
      // crawler's patch then widens the exposure set at call time.
      before: [],
      after: ['plugin'],
      live: ['plugin', 'late'],
    })
    // The built launch form bound under the filePaths stub (the target now
    // resolves from the registry as lib/index.js): the private
    // `exposedNamespaces` decision inside createApiProxy was rewritten.
    expect(outcome.bindings['web-config-crawler/exposed-namespaces']).toEqual([
      { module: '@deepseek-ai/dsh-host-apiproxy', file: 'lib/index.js', nodes: 1 },
    ])
  }, 30_000)
})
