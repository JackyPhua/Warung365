// src/services/SyncService.js
// WiFi LAN sync using WebSocket
// In browser: runs as client to simple WS server
// In production APK: Capacitor plugin provides TCP socket directly

class SyncService {
  constructor() {
    this.ws = null
    this.mode = 'main'
    this.onStateUpdate = null
    this.onClientChange = null
    this.reconnectTimer = null
    this.serverIp = null
  }

  getLocalIP() {
    // Best effort - in browser we can't get true local IP without WebRTC trick
    // For APK build with Capacitor, this will be replaced with native call
    return new Promise((resolve) => {
      if (window.CAPACITOR_LOCAL_IP) {
        resolve(window.CAPACITOR_LOCAL_IP)
        return
      }
      try {
        const pc = new RTCPeerConnection({ iceServers: [] })
        pc.createDataChannel('')
        pc.createOffer().then(o => pc.setLocalDescription(o))
        pc.onicecandidate = (e) => {
          if (!e.candidate) return
          const match = e.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)
          if (match && !match[1].startsWith('0.')) {
            pc.close()
            resolve(match[1])
          }
        }
        setTimeout(() => { pc.close(); resolve('192.168.1.100') }, 2000)
      } catch (e) {
        resolve('192.168.1.100')
      }
    })
  }

  // ── Main mode ──
  // In browser demo mode, main just shows QR with IP.
  // Real sync needs relay server or Capacitor TCP plugin.
  async startServer(onClientChange) {
    this.mode = 'main'
    this.onClientChange = onClientChange
    this.serverIp = await this.getLocalIP()
    console.log('[Sync] Main mode, IP:', this.serverIp)
    return this.serverIp
  }

  stopServer() {
    this.mode = null
    if (this.onClientChange) this.onClientChange([])
  }

  broadcastState(state) {
    // In browser demo: just log
    console.log('[Sync] Broadcast state', Object.keys(state.orders).length, 'orders')
  }

  // ── Sub mode ──
  connectToServer(serverIp, onStateSync, onConnect, onDisconnect) {
    this.mode = 'sub'
    this.serverIp = serverIp
    this.onStateUpdate = onStateSync
    console.log('[Sync] Sub mode, connecting to:', serverIp)
    // In browser demo: just simulate successful connection
    setTimeout(() => onConnect && onConnect(), 500)
  }

  disconnectFromServer() {
    if (this.ws) {
      try { this.ws.close() } catch (e) {}
      this.ws = null
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
  }

  sendAction(action) {
    console.log('[Sync] Send action', action.type)
  }
}

export default new SyncService()
