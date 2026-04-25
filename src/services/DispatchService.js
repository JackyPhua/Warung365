// src/services/DispatchService.js
// "1 host + many workers" dispatch over Wi‑Fi Direct TCP (Android APK).
// Web mode: still generates QR but cannot auto-connect.

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
    this._unsubs = []
    this._workerId = null
    this._workerName = null
  }

  get isNative() {
    return WifiDirectService.isSupported
  }

  getJoinPayload({ shopName, storeId }) {
    return {
      t: 'WORKER_JOIN',
      shopName: shopName || '',
      storeId: storeId || '',
      port: this.port,
      v: 1,
    }
  }

  async startHost({ shopName, storeId, onWorkers } = {}) {
    this.stop()
    this.mode = 'host'
    this.onWorkers = onWorkers || null
    this.workers = []
    this._notifyWorkers()

    if (!this.isNative) {
      return { ok: true, mode: 'web' }
    }

    await WifiDirectService.requestPermissions()
    await WifiDirectService.createGroupOwner()
    await WifiDirectService.startServer(this.port)

    this._wire()
    return { ok: true, join: this.getJoinPayload({ shopName, storeId }) }
  }

  async connectWorker({ joinPayload, name, onJob } = {}) {
    this.stop()
    this.mode = 'worker'
    this.onJob = onJob || null
    this._workerName = (name || uniqName()).trim()

    if (!this.isNative) {
      throw new Error('Worker connect requires Android APK build')
    }

    await WifiDirectService.requestPermissions()
    await WifiDirectService.discoverPeers()

    const peers = await this._waitForPeers(3000)
    if (!peers.length) throw new Error('No Wi‑Fi Direct peers found')

    await WifiDirectService.connect(peers[0].deviceAddress)

    const info = await this._waitForConnectionInfo(7000)
    const host = info?.groupOwnerAddress || '192.168.49.1'
    const port = joinPayload?.port || this.port

    await WifiDirectService.connectToGroupOwner({ host, port })

    this._wire()

    // HELLO handshake
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

    // Optional: track accept/done
    // For now just ignore or log.
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

