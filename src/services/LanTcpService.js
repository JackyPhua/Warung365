// src/services/LanTcpService.js
// Android: Capacitor LanTcp plugin — TCP sync on the shop Wi‑Fi (router LAN only).
// Web: safe stubs so the app does not crash.

import { registerPlugin } from '@capacitor/core'

let isNativeAndroid = false
let nativePlugin = null
try {
  isNativeAndroid = window?.Capacitor?.getPlatform?.() === 'android' && window?.Capacitor?.isNativePlatform?.()
  if (isNativeAndroid) {
    nativePlugin = registerPlugin('LanTcp')
  }
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
  return nativePlugin
}

class LanTcpService {
  get isSupported() {
    return isNativeAndroid && !!nativePlugin
  }

  async getLocalIp() {
    if (!this.isSupported) return { available: false }
    return await getPlugin().getLocalIp()
  }

  async startServer(port = 8765) {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().startServer({ port })
  }

  async stopServer() {
    if (!this.isSupported) return { ok: true }
    return await getPlugin().stopServer()
  }

  async connectToGroupOwner({ host, port = 8765, retries = 5 } = {}) {
    if (!this.isSupported) throw new Error('Not supported')
    return await getPlugin().connectToGroupOwner({ host, port, retries })
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

export default new LanTcpService()
