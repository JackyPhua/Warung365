// src/services/LicenseService.js
// Offline license validation
//
// Formats:
// 1) POS-01MT-XXXX-XXXX  (1 / 3 / 6 / 12 months) — middle flag + random 4+4; checksum on last 8 chars (sum % 7 === 0)
// 2) Legacy POS-XXXX-XXXX-XXXX — checksum on all 12 body chars (sum % 7 === 0) → treated as 1 calendar month
// 3) Demo keys (hardcoded lists) → 1 calendar month

const CHAL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Second segment → months (calendar, via setMonth) */
const TERM_MONTHS = {
  '01MT': 1,
  '03MT': 3,
  '06MT': 6,
  '12MT': 12,
}

function bodyChecksumOk(body) {
  const sum = body.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return sum % 7 === 0
}

function addCalendarMonths(fromMs, months) {
  const d = new Date(fromMs)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

class LicenseService {
  /**
   * @returns {{ valid: false } | { valid: true, type: string, expiry: string, key: string, months: number }}
   */
  validateKey(key) {
    if (!key) return { valid: false }
    const trimmed = key.trim().toUpperCase()

    const DEMO_KEYS = [
      'POS-DEMO-TEST-KEY1',
      'POS-ALPHA-2024-MAIN',
      'POS-BETA-2024-MAIN',
    ]
    if (DEMO_KEYS.includes(trimmed)) {
      const months = 1
      return {
        valid: true,
        type: 'monthly',
        expiry: addCalendarMonths(Date.now(), months),
        key: trimmed,
        months,
      }
    }

    const parts = trimmed.split('-')
    if (parts.length !== 4 || parts[0] !== 'POS') return { valid: false }
    if (parts[1].length !== 4 || parts[2].length !== 4 || parts[3].length !== 4) return { valid: false }

    const p2p3 = parts[2] + parts[3]

    if (TERM_MONTHS[parts[1]] != null) {
      const months = TERM_MONTHS[parts[1]]
      if (!bodyChecksumOk(p2p3)) return { valid: false }
      return {
        valid: true,
        type: 'monthly',
        expiry: addCalendarMonths(Date.now(), months),
        key: trimmed,
        months,
      }
    }

    // Legacy: checksum on full 12-character body (three 4-char segments)
    const legacyBody = parts[1] + parts[2] + parts[3]
    if (!bodyChecksumOk(legacyBody)) return { valid: false }
    const months = 1
    return {
      valid: true,
      type: 'monthly',
      expiry: addCalendarMonths(Date.now(), months),
      key: trimmed,
      months,
    }
  }

  /**
   * Generate a key for customers. Duration: 1 | 3 | 6 | 12 (calendar months).
   * @param {1|3|6|12} [months=1]
   */
  generateKey(months = 1) {
    const flag = Object.entries(TERM_MONTHS).find(([, m]) => m === months)?.[0]
    if (!flag) throw new Error('months must be 1, 3, 6, or 12')

    for (let attempt = 0; attempt < 5000; attempt++) {
      const p2 = Array.from({ length: 4 }, () => CHAL[Math.floor(Math.random() * CHAL.length)]).join('')
      const p3 = Array.from({ length: 4 }, () => CHAL[Math.floor(Math.random() * CHAL.length)]).join('')
      if (bodyChecksumOk(p2 + p3)) return `POS-${flag}-${p2}-${p3}`
    }
    return null
  }
}

export default new LicenseService()
