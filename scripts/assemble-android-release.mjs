import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const androidDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'android')
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
const r = spawnSync(path.join(androidDir, gradlew), ['assembleRelease'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(typeof r.status === 'number' ? r.status : 1)
