#!/usr/bin/env node
/**
 * Usage: node scripts/generate-license-key.mjs [1|3|6|12]
 * Example: node scripts/generate-license-key.mjs 12
 *
 * Key shape: POS-{01MT|03MT|06MT|12MT}-XXXX-XXXX
 * Expiry is counted in calendar months from activation time in the app.
 */
import LicenseService from '../src/services/LicenseService.js'

const m = parseInt(process.argv[2] || '1', 10)
if (![1, 3, 6, 12].includes(m)) {
  console.error('Usage: node scripts/generate-license-key.mjs <1|3|6|12>')
  process.exit(1)
}

const key = LicenseService.generateKey(m)
if (!key) {
  console.error('Failed to generate (try again)')
  process.exit(2)
}
console.log(key)
const v = LicenseService.validateKey(key)
console.error(`→ ${v.months} month(s), checksum OK: ${v.valid}`)
