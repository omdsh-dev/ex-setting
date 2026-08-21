import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const lib = join(root, '..', 'lib')
const temporary = join(lib, '.client-dts')

for (const file of ['client.d.ts', 'client.d.ts.map']) {
  const source = join(temporary, file)
  const target = join(lib, file)
  await mkdir(dirname(target), { recursive: true })
  await rename(source, target)
}

await rm(temporary, { recursive: true, force: true })
