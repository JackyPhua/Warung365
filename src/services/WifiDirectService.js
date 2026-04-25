// src/services/WifiDirectService.js
// Thin wrapper around the native Capacitor WifiDirect plugin (Android only).
// Web mode: all methods return safe fallbacks so the app doesn't crash.

let isNativeAndroid = false
try {
  isNativeAndroid = window?.Capacitor?.getPlatform?.() === 'android' && window?.Capacitor?.isNativePlatform?.()
} catch (e) {}

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(base64) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function getPlugin() {
  const p = globalThis?.Capacitor?.Plugins?.WifiDirect
  if (!p) throw new Error('WifiDirect plugin not available (native Android build only)')
  return p
}

class WifiDirectService {
  get isSupported() {
    return isNativeAndroid
  }

  async requestPermissions() {
    if (!this.isSupported) return { granted: false }
    return await getPlugin().requestPermissions()
  }

  async createGroupOwner() {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().createGroupOwner()
  }

  async removeGroup() {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().removeGroup()
  }

  async discoverPeers() {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().discoverPeers()
  }

  async getPeers() {
    if (!this.isSupported) return { peers: [] }
    return await getPlugin().getPeers()
  }

  async connect(deviceAddress) {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().connect({ deviceAddress })
  }

  async requestConnectionInfo() {
    if (!this.isSupported) return { available: false }
    return await getPlugin().requestConnectionInfo()
  }

  async startServer(port = 8765) {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().startServer({ port })
  }

  async stopServer() {
    if (!this.isSupported) return { ok: true }
    return await getPlugin().stopServer()
  }

  async connectToGroupOwner({ host, port = 8765 } = {}) {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().connectToGroupOwner({ host, port })
  }

  async disconnectClient() {
    if (!this.isSupported) return { ok: true }
    return await getPlugin().disconnectClient()
  }

  async sendBytes(bytes) {
    if (!this.isSupported) throw new Error('Not supported')
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const base64 = bytesToBase64(u8)
    return await getPlugin().send({ base64 })
  }

  async sendJson(obj) {
    const json = JSON.stringify(obj)
    const bytes = new TextEncoder().encode(json)
    return await this.sendBytes(bytes)
  }

  decodeBase64ToJson(base64) {
    const bytes = base64ToBytes(base64)
    const text = new TextDecoder().decode(bytes)
    return JSON.parse(text)
  }

  addListener(eventName, cb) {
    if (!this.isSupported) return Promise.resolve({ remove: () => {} })
    return getPlugin().addListener(eventName, cb)
  }
}

export default new WifiDirectService()
