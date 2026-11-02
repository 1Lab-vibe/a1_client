import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
await mkdir('tmp', { recursive: true })
await build({ entryPoints: ['scripts/procurement-contract-examples.ts'], outfile: 'tmp/procurement-examples.mjs', bundle: true, platform: 'node', format: 'esm', packages: 'external' })
await import('../tmp/procurement-examples.mjs')
console.log('Generated docs/procurement-contract-examples.json from validated adapter responses')
