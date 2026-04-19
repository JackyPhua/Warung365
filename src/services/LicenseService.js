// src/services/LicenseService.js
// Offline license validation
// Key format: POS-XXXX-XXXX-XXXX (checksum divisible by 7)

class LicenseService {
  validateKey(key) {
    if (!key) return { valid: false }
    const trimmed = key.trim().toUpperCase()

    // Hardcoded demo keys (for testing/first customers)
    const DEMO_KEYS = [
      'POS-DEMO-TEST-KEY1',
      'POS-ALPHA-2024-MAIN',
      'POS-BETA-2024-MAIN',
    ]
    if (DEMO_KEYS.includes(trimmed)) {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      return { valid: true, type: 'monthly', expiry, key: trimmed }
    }

    // Checksum validation: POS-XXXX-XXXX-XXXX
    const parts = trimmed.split('-')
    if (parts.length !== 4 || parts[0] !== 'POS') return { valid: false }
    if (parts[1].length !== 4 || parts[2].length !== 4 || parts[3].length !== 4) return { valid: false }

    const chars = (parts[1] + parts[2] + parts[3]).split('')
    const sum = chars.reduce((s, c) => s + c.charCodeAt(0), 0)
    if (sum % 7 === 0) {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      return { valid: true, type: 'monthly', expiry, key: trimmed }
    }

    return { valid: false }
  }

  // Helper to generate valid keys (for you to give to customers)
  generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for (let attempt = 0; attempt < 1000; attempt++) {
      const p1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const p2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const p3 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
      const sum = (p1 + p2 + p3).split('').reduce((s, c) => s + c.charCodeAt(0), 0)
      if (sum % 7 === 0) return `POS-${p1}-${p2}-${p3}`
    }
    return null
  }
}

export default new LicenseService()
