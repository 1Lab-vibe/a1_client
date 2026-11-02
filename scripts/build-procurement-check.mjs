import { spawnSync } from 'node:child_process'
// Build verification does not embed values from the legacy webhook environment.
const env = { ...process.env, VITE_A1_WEBHOOK_SECRET: '', VITE_N8N_WEBHOOK_URL: '' }
for (const args of [['node_modules/typescript/bin/tsc', '-b'], ['node_modules/vite/bin/vite.js', 'build']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
