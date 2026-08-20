import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/**
 * Shared browser client bundle preset. The web shell loads
 * `/plugins/<id>/client.js` as a classic script and resolves every
 * cross-package value import through the loader module table, so the bundle
 * must ship in the dsh closure-factory artifact
 * (`window.__ModuleLoader__.load({id, factory})`) with the table entries
 * external. Plain ESM bundles cannot load there.
 *
 * Externals are exactly the loader-table entries this bundle requires by
 * value: the platform modules (react, cordis, ui-slots, schema-form) and the
 * documented runtime store exemption (createSnapshotStore lives in
 * dsh-client-runtime pending its rehoming). cordis-fabric/client is NOT a
 * table entry — the cordis-fabric row is disabled (the library package has
 * no host plugin form), so its browser factory never registers and a
 * synchronous require would miss the table. The browser half mounts its own
 * FabricService copy instead (the bridge is a globalThis singleton), so the
 * trio's client source is inlined via alias. Everything else is inlined;
 * type-only imports never reach the bundle.
 */
export const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** Package id the client bundle registers under (the module-table key). */
export const CLIENT_ID = '@deepseek-ai/dsh-ex-setting'

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * The browser client bundle config: closure-factory artifact with the loader
 * table external and CSS Modules compiled inline.
 * @param entry - the client entry.
 * @param tsconfig - TypeScript config used for the client source.
 * @param declarations - emit a temporary ESM runtime plus bundled declarations;
 * the following closure build overwrites only the runtime file.
 */
export function clientBundle(entry: string, tsconfig?: string, declarations = false): UserConfig {
  return {
    entry: { client: entry },
    outDir: 'lib',
    format: declarations ? 'esm' : 'cjs',
    platform: 'browser',
    target: 'es2022',
    // The closure build must stay declaration-free: its banner/footer are
    // executable wrapper code, not valid TypeScript declaration syntax.
    dts: declarations,
    // Plugin code is fetched outside Vite's module graph, so its own bundle
    // must carry the TS/TSX mapping consumed by browser profiling tools.
    sourcemap: true,
    clean: false,
    // tsdown auto-externalizes package dependencies; the loader table is the
    // only external source, everything else must inline.
    deps: {
      neverBundle: CLIENT_EXTERNALS,
      alwaysBundle: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
      dts: { neverBundle: true },
    },
    ...(tsconfig === undefined ? {} : { tsconfig }),
    outputOptions: declarations
      ? {}
      : {
          entryFileNames: 'client.js',
          banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(CLIENT_ID)}, factory: (require) => {`,
          footer: 'return module.exports; } });',
          intro: 'var module = { exports: {} }; var exports = module.exports;',
        },
    plugins: [{
      // CSS Modules compile to a hashed class map plus a <style data-plugin>
      // tag injected at factory execution (the loader removes plugin-owned
      // tags on unload), mirroring the official clientBundle preset.
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
        return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
        this.addWatchFile(fileId)
        const source = await readFile(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap: Record<string, string> = {}
        for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
        // One <style data-plugin> per module file; idempotent under re-evaluation.
        return [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(`${CLIENT_ID}/${basename(fileId)}`)};`,
          'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
          '  const tag = document.createElement(\'style\');',
          `  tag.dataset.plugin = ${JSON.stringify(CLIENT_ID)};`,
          '  tag.dataset.pluginCss = tagId;',
          '  tag.textContent = css;',
          '  document.head.appendChild(tag);',
          '}',
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
      },
    }],
  }
}
