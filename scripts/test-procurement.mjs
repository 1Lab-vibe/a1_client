import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
await mkdir('tmp', { recursive: true })
await build({
  entryPoints: ['tests/procurement.test.ts'],
  outfile: 'tmp/procurement.test.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
})
const result = spawnSync(
  process.execPath,
  ['--test', 'tmp/procurement.test.mjs'],
  { stdio: 'inherit' },
)
process.exitCode = result.status ?? 1
