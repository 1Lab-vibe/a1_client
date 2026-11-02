import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
mkdirSync('output/playwright', { recursive: true })
// Requires the local dev server on 127.0.0.1:5173; setup blocks external traffic.
const cli = (...args) => {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes', '--package', '@playwright/cli', 'playwright-cli', '-s=procurement-ui', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) throw new Error(`Playwright failed: ${args[0]}`)
}
cli('open', 'http://127.0.0.1:5173')
try {
  for (const script of ['setup', 'filters', 'start', 'analyze', 'results', 'files', 'race']) cli('run-code', '--filename', `scripts/procurement-ui-${script}.cjs`)
  console.log('All procurement UI scenarios passed')
} finally { cli('close') }
