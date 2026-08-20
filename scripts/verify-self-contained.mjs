#!/usr/bin/env node
/**
 * Self-contained repository verification for `@deepseek-ai/dsh-ex-setting`.
 *
 * The bundle is a dual-face external plugin: a host crawler (src/index.ts,
 * src/routes.ts, src/nav-scroll.ts, src/invariant.ts) and a browser client
 * half (src/client/). Host-provided packages (`@deepseek-ai/dsh-*`, the
 * `@deepseek-ai/cordis` vendor) are private and not installable from the
 * registry; the Fabric trio arrives as prebuilt GitHub Release tarballs. This
 * script verifies everything that must hold without a sibling checkout:
 * repository layout, no absolute workstation paths, no non-`@deepseek-ai/*` bare
 * imports beyond the declared registry/tarball dependencies, and manifest
 * integrity.
 * @module scripts/verify-self-contained
 */

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const ignoredDirectories = new Set(['.git', 'lib', 'node_modules', '.agents'])
const textExtensions = new Set(['.cjs', '.cts', '.js', '.json', '.jsx', '.md', '.mjs', '.mts', '.ts', '.tsx', '.yaml', '.yml'])
const codeExtensions = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const failures = []
const textFiles = []

function isInsideRoot(target) {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const fullPath = join(directory, entry.name)
    if (entry.isSymbolicLink()) {
      try {
        const target = realpathSync(fullPath)
        if (!isInsideRoot(target)) failures.push(`${relative(root, fullPath)}: symlink leaves repository`)
      } catch (error) {
        failures.push(`${relative(root, fullPath)}: broken symlink (${error.message})`)
      }
      continue
    }
    if (entry.isDirectory()) {
      walk(fullPath)
    } else if (entry.isFile() && textExtensions.has(extname(entry.name))) {
      textFiles.push(fullPath)
    }
  }
}

walk(root)

for (const filePath of textFiles) {
  const rel = relative(root, filePath)
  const source = readFileSync(filePath, 'utf8')
  if (rel !== 'scripts/verify-self-contained.mjs') {
    const absolutePath = source.match(/(?:^|\s|["'`(=,:])((?:\/(?:home|Users)\/[^/\s"'`<>]+|(?:[A-Za-z]:[\\/][^\s"'`<>]+)))/m)
    if (absolutePath !== null) failures.push(`${rel}: contains absolute workstation path ${absolutePath[1]}`)
  }
  if (extname(filePath) === '.md') {
    // Language-switch links to the repository-root README are allowed; any
    // other parent-directory navigation is not.
    const withoutLanguageSwitch = source.replace(/\[[^\]]+\]\(\.\.\/README(?:\.zh)?\.md\)/g, '')
    if (/\.\.[/\\]/.test(withoutLanguageSwitch)) failures.push(`${rel}: documentation uses parent-directory navigation`)
    for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const rawTarget = match[1].trim().replace(/^<|>$/g, '')
      if (rawTarget.startsWith('#') || rawTarget.startsWith('mailto:')) continue
      if (/^[a-z][a-z+.-]*:/i.test(rawTarget)) {
        failures.push(`${rel}: external Markdown link ${rawTarget}`)
        continue
      }
      const targetPath = resolve(dirname(filePath), rawTarget.split('#')[0])
      if (!isInsideRoot(targetPath)) {
        failures.push(`${rel}: Markdown link leaves repository: ${rawTarget}`)
      } else if (!existsSync(targetPath)) {
        failures.push(`${rel}: broken Markdown link: ${rawTarget}`)
      }
    }
  }
}

// Repository-layout contracts for the dual-face bundle.
for (const requiredPath of [
  'src/index.ts',
  'src/invariant.ts',
  'src/routes.ts',
  'src/nav-scroll.ts',
  'src/client/index.ts',
  'src/client/invariant.ts',
  'tests/host',
  'tests/client',
  'tests/host/fixtures',
  'docs/web-config-crawler.md',
  'docs/ui-settings-plugins.md',
  'patches/README.md',
]) {
  if (!existsSync(join(root, requiredPath))) failures.push(`missing repository-layout contract ${requiredPath}`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const fabricNames = ['cordis-fabric', 'cordis-fabric-api']
const fabricReleaseSpecs = new Map([
  ['cordis-fabric', 'https://github.com/omdsh-dev/fabric/releases/download/v0.1.0/cordis-fabric.tgz'],
  ['cordis-fabric-api', 'https://github.com/omdsh-dev/fabric/releases/download/v0.1.0/cordis-fabric-api.tgz'],
])
for (const name of fabricNames) {
  if (packageJson.peerDependencies?.[name] !== '^0.1.0') failures.push(`package.json: ${name} must be a required ^0.1.0 peer dependency`)
  if (packageJson.dependencies?.[name] !== undefined) failures.push(`package.json: ${name} must not be a runtime dependency`)
  if (packageJson.bundledDependencies?.includes(name)) failures.push(`package.json: ${name} must not be bundled into ex-setting`)
  if (packageJson.devDependencies?.[name] !== fabricReleaseSpecs.get(name)) {
    failures.push(`package.json: devDependencies.${name} must use the Fabric release tarball ${fabricReleaseSpecs.get(name)}`)
  }
}
for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const [name, spec] of Object.entries(packageJson[field] ?? {})) {
    if (/^(?:file|link|portal|workspace):/i.test(spec) || spec.startsWith('.') || isAbsolute(spec)) {
      failures.push(`package.json: ${field}.${name} uses non-registry spec ${spec}`)
    }
  }
}

// Host-provided packages resolve from the registry; every OTHER non-relative
// import must be declared above. Any `@deepseek-ai/*` import is accepted when
// at least one `@deepseek-ai` package is declared (they share one resolution
// contract). Fabric imports are required peers and are available in this
// checkout through their pinned devDependency tarballs.
const declared = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
])
const allowedBare = new Set(declared)
allowedBare.add('@deepseek-ai/dsh-ex-setting/client')
const hasScopedHost = [...declared].some(name => name.startsWith('@deepseek-ai/'))
for (const filePath of textFiles) {
  const rel = relative(root, filePath)
  if (!codeExtensions.has(extname(filePath))) continue
  const source = readFileSync(filePath, 'utf8')
  for (const match of source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|require\.resolve\s*\(\s*|import\s+)['"]([^'".][^'"]*)['"]/g)) {
    const spec = match[1]
    if (spec.startsWith('.') || spec.startsWith('node:') || spec === 'assert' || spec === 'fs' || spec === 'path' || spec === 'os' || spec === 'url' || spec === 'util' || spec === 'events' || spec === 'child_process' || spec === 'stream' || spec === 'http' || spec === 'https') continue
    if (spec.includes('/') && !spec.startsWith('@deepseek-ai/') && !allowedBare.has(spec.split('/')[0])) continue
    if (hasScopedHost && spec.startsWith('@deepseek-ai/')) continue
    if (!allowedBare.has(spec) && !allowedBare.has(spec.split('/')[0])) {
      failures.push(`${rel}: undeclared bare import ${spec}`)
    }
  }
}

const lockfileSource = readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8')
for (const match of lockfileSource.matchAll(/(?:^|[\s'"])(file|link|portal):([^\s'",}\]]+)/g)) {
  failures.push(`pnpm-lock.yaml: contains local dependency spec ${match[1]}:${match[2]}`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`self-contained repository verified (${textFiles.length} text files)`)
