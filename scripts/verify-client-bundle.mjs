import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('..', import.meta.url)
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const clientPath = fileURLToPath(new URL('lib/client.js', root))
const source = await readFile(clientPath, 'utf8')
const errors = []
const expectedId = JSON.stringify(packageJson.name)

if (!source.trimStart().startsWith('window.__ModuleLoader__.load(')) {
  errors.push('client.js must start with the classic ModuleLoader registration')
}
if (!source.includes(`id: ${expectedId}`)) {
  errors.push(`client.js must register module id ${expectedId}`)
}
if (!source.includes('factory: (require) =>')) {
  errors.push('client.js must expose a closure factory')
}
if (!source.includes('return module.exports;')) {
  errors.push('client.js must return the factory module exports')
}
if (/^\s*(?:import|export)\b/m.test(source)) {
  errors.push('client.js must not leak top-level ESM syntax')
}
if (/\bimport\s*\(/.test(source)) {
  errors.push('client.js must not contain dynamic imports')
}

const externals = [...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1])
const allowedExternals = new Set(['react', 'react/jsx-runtime'])
const unexpected = [...new Set(externals.filter(specifier => !allowedExternals.has(specifier)))]
if (unexpected.length > 0) {
  errors.push(`unexpected module-table externals: ${unexpected.join(', ')}`)
}
if (source.match(/\brequire\(["']@deepseek-ai\/dsh-client-schema-form["']\)/)) {
  errors.push('schema-form helpers must be inlined, not loaded from the module table')
}

if (errors.length > 0) {
  throw new Error(`client bundle contract failed:\n- ${errors.join('\n- ')}`)
}

console.log(JSON.stringify({
  file: join('lib', 'client.js'),
  moduleId: packageJson.name,
  externals: [...new Set(externals)],
}))
