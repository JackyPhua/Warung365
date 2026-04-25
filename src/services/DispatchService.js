// src/services/DispatchService.js
// "1 host + many workers" dispatch over LAN TCP (Android APK).
// Recommended: use a router hotspot. Web mode: generates QR but cannot auto-connect.

import WifiDirectService from './WifiDirectService'

function nowIso() {
  return new Date().toISOString()
}

function uniqName() {
  const n = Math.floor(Math.random() * 9000) + 1000
  return `Worker-${n}`
}

class DispatchService {
  constructor() {
    this.mode = null // 'host' | 'worker'
    this.port = 8765
    this.workers = [] // { id, name, remoteAddress }
    this.onWorkers = null
    this.onJob = null
    this.onState = null
    this.onWorkerOrders = null
    this._unsubs = []
    this._workerId = null
    this._workerName = null
    this._hostDeviceAddress = null
    this._hostIp = null
  }

  get isNative() {
    return WifiDirectService.isSupported
  }

  getJoinPayload({ shopName, storeId } = {}) {
    return {
      t: 'WORKER_JOIN',
      shopName: shopName || '',
      storeId: storeId || '',
      port: this.port,
      hostDeviceAddress: this._hostDeviceAddress || undefined,
      hostIp: this._hostIp || undefined,
      v: 1,
    }
  }

  async startHost({ shopName, storeId, onWorkers } = {}) {
    await this.stop()
    this.mode = 'host'
    this.onWorkers = onWorkers || null
    this.workers = []
    this._notifyWorkers()

    if (!this.isNative) {
      return { ok: true, mode: 'web' }
    }

    // LAN hotspot mode: no peer discovery / no group owner creation.
    // Host just starts a TCP server and publishes its LAN IP via QR.
    await WifiDirectService.startServer(this.port)

    const ip = await WifiDirectService.getLocalIp()
    this._hostIp = ip?.ip || null
    this._hostDeviceAddress = null

    this._wire()
    return { ok: true, join: this.getJoinPayload({ shopName, storeId }), hostIp: this._hostIp }
  }

  async connectWorker({ joinPayload, name, onJob } = {}) {
    await this.stop()
    this.mode = 'worker'
    this.onJob = onJob || null
    this._workerName = (name || uniqName()).trim()

    if (!this.isNative) {
      // Fallback: use localStorage cross-tab sync instead of WifiDirect
      this._workerId = `W-local-${Date.now()}`
      return { ok: true, host: 'localStorage', port: 0, name: this._workerName, mode: 'local' }
    }

    const host = joinPayload?.hostIp
    if (!host) throw new Error('Missing host IP in QR/JSON')
    const port = joinPayload?.port || this.port

    await WifiDirectService.connectToGroupOwner({ host, port, retries: 5 })

    this._wire()

    await new Promise(r => setTimeout(r, 300))

    await WifiDirectService.sendJson({
      t: 'HELLO',
      role: 'worker',
      name: this._workerName,
      at: nowIso(),
    })

    return { ok: true, host, port, name: this._workerName }
  }

  async stop() {
    if (!this.mode) return
    this._unwire()

    if (this.isNative) {
      if (this.mode === 'host') {
        try { await WifiDirectService.stopServer() } catch (e) {}
        try { await WifiDirectService.removeGroup() } catch (e) {}
      } else if (this.mode === 'worker') {
        try { await WifiDirectService.disconnectClient() } catch (e) {}
      }
    }

    this.mode = null
    this.onJob = null
    this.onWorkers = null
    this.workers = []
    this._workerId = null
    this._workerName = null
  }

  // Host: broadcast a new job to all workers
  async broadcastNewJob(job) {
    if (this.mode !== 'host') return
    if (!this.isNative) return
    await WifiDirectService.sendJson({ t: 'NEW_JOB', job })
  }

  // Host: broadcast full state snapshot to workers
  async broadcastState(state) {
    if (this.mode !== 'host') return
    if (!this.isNative) return
    await WifiDirectService.sendJson({ t: 'STATE', state })
  }

  // Worker: send orders+tables snapshot back to host
  async sendOrdersToHost(orders, tables) {
    if (this.mode !== 'worker') return
    if (!this.isNative) return
    await WifiDirectService.sendJson({ t: 'WORKER_ORDERS', orders, tables })
  }

  // Worker: accept/done (optional for now)
  async acceptJob(jobId) {
    if (this.mode !== 'worker') return
    if (!this.isNative) return
    await WifiDirectService.sendJson({ t: 'ACCEPT_JOB', jobId, at: nowIso(), workerId: this._workerId })
  }

  async doneJob(jobId) {
    if (this.mode !== 'worker') return
    if (!this.isNative) return
    await WifiDirectService.sendJson({ t: 'DONE_JOB', jobId, at: nowIso(), workerId: this._workerId })
  }

  // ───────────────────────── internal ─────────────────────────
  _notifyWorkers() {
    if (this.onWorkers) this.onWorkers(this.workers)
  }

  _wire() {
    if (!this.isNative) return
    if (this._unsubs.length) return

    const sub = (name, cb) => WifiDirectService.addListener(name, cb)

    sub('message', (ev) => {
      const base64 = ev?.base64
      if (!base64) return
      let msg
      try {
        msg = WifiDirectService.decodeBase64ToJson(base64)
      } catch (e) {
        return
      }

      if (this.mode === 'host') this._handleHostMessage(msg, ev?.from)
      else if (this.mode === 'worker') this._handleWorkerMessage(msg)
    }).then(h => this._unsubs.push(h))
  }

  _unwire() {
    const unsubs = this._unsubs
    this._unsubs = []
    for (const h of unsubs) {
      try { h?.remove && h.remove() } catch (e) {}
    }
  }

  async _handleHostMessage(msg, from) {
    if (!msg?.t) return
    if (msg.t === 'HELLO' && msg.role === 'worker') {
      const remoteAddress = from?.remoteAddress || 'worker'
      const id = `W-${remoteAddress.replace(/\./g, '_')}`
      const name = String(msg.name || remoteAddress)

      const exists = this.workers.some(w => w.id === id)
      if (!exists) {
        this.workers = [...this.workers, { id, name, remoteAddress }]
        this._notifyWorkers()
      }

      await WifiDirectService.sendJson({ t: 'WELCOME', workerId: id, at: nowIso() })
      return
    }

    // Worker pushed its orders/tables back to host
    if (msg.t === 'WORKER_ORDERS' && msg.orders && msg.tables) {
      if (this.onWorkerOrders) this.onWorkerOrders(msg.orders, msg.tables)
      return
    }
  }

  _handleWorkerMessage(msg) {
    if (!msg?.t) return
    if (msg.t === 'WELCOME') {
      this._workerId = msg.workerId || this._workerId
      return
    }
    if (msg.t === 'NEW_JOB' && msg.job) {
      if (this.onJob) this.onJob(msg.job)
      return
    }
    if (msg.t === 'STATE' && msg.state) {
      if (this.onState) this.onState(msg.state)
      return
    }
  }

  _waitForPeers(timeoutMs) {
    const start = Date.now()
    return new Promise((resolve) => {
      const tick = async () => {
        try {
          const r = await WifiDirectService.getPeers()
          const peers = Array.isArray(r?.peers) ? r.peers : []
          if (peers.length) { resolve(peers); return }
        } catch (e) {}
        if (Date.now() - start >= timeoutMs) { resolve([]); return }
        setTimeout(tick, 350)
      }
      tick()
    })
  }

  _waitForConnectionInfo(timeoutMs) {
    const start = Date.now()
    return new Promise((resolve) => {
      const tick = async () => {
        try {
          const info = await WifiDirectService.requestConnectionInfo()
          if (info?.available) { resolve(info); return }
        } catch (e) {}
        if (Date.now() - start >= timeoutMs) { resolve(null); return }
        setTimeout(tick, 350)
      }
      tick()
    })
  }
}

export default new DispatchService()

