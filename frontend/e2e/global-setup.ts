import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../..')
const HEALTH_URL = 'http://localhost:8000/health'

async function waitForBackend(retries = 10, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(HEALTH_URL)
      if (response.ok) return
    } catch {
      // backend not reachable yet, retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(
    `Backend not reachable at ${HEALTH_URL} after ${retries} attempts. ` +
      'Is `docker compose up` running from the repo root?',
  )
}

export default async function globalSetup(): Promise<void> {
  await waitForBackend()
  execSync('docker compose exec -T redis redis-cli FLUSHALL', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
}
