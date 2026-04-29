// src/services/DispatchService.js
// "1 host + many workers" dispatch over LAN TCP (Android APK).
// Uses router WiFi (not WiFi Direct peer-to-peer).
// Web mode: generates QR but cannot auto-connect.

import LanTcpService from './LanTcpService'

function nowIso() { return new Date().toISOString() }
function uniqName() { return `Worker-${Math.floor(Math.random() * 9000) + 1000}` }

const HEARTBEAT_INTERVAL = 15000  // 15 seconds
const RECONNECT_DELAY    = 3000   // 3 seconds

class DispatchService {
  constructor() {
    this.mode        = null   // 'host' | 'worker'
    this.port        = 8765
    this.workers     = []     // { id, name, remoteAddress }
    this.onWorkers   = null
    this.onJob       = null
    this.onState     = null
    this.onWorkerOrders  = null
    this.onReadyNotify   = null
    this.onJobProgress   = null  // host: ACCEPT_JOB / DONE_JOB from workers
    this._unsubs     = []
    this._workerId   = null
    this._workerName = null
    this._hostIp     = null
    this._joinPayload = null   // saved for reconnect

    // Heartbeat / reconnect handles
    this._heartbeatTimer  = null
    this._reconnectTimer  = null
    this._stopped         = false
  }

  get isNative() { return LanTcpService.isSupported }

  getJoinPayload({ shopName, storeId, language } = {}) {
    return {
      t: 'WORKER_JOIN',
      shopName:  shopName  || '',
      storeId:   storeId   || '',
      language:  language  || 'zh',
      port:      this.port,
      hostIp:    this._hostIp || undefined,
      v: 1,
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  HOST
  // ═══════════════════════════════════════════════════════════════
  async startHost({ shopName, storeId, language, onWorkers } = {}) {
    await this.stop()
    this._stopped = false
    this.mode = 'host'
    this.onWorkers = onWorkers || null
    this.workers = []
    this._notifyWorkers()

    if (!this.isNative) {
      return { ok: true, mode: 'web' }
    }

    await LanTcpService.startServer(this.port)

    const ipResult = await LanTcpService.getLocalIp()
    this._hostIp = ipResult?.ip || null

    this._wire()
    this._startHostHeartbeat()

    return {
      ok: true,
      join: this.getJoinPayload({ shopName, storeId, language }),
      hostIp: this._hostIp,
    }
  }

  // Host heartbeat: ping all workers every 15s
  _startHostHeartbeat() {
    this._clearTimers()
    this._heartbeatTimer = setInterval(async () => {
      if (this.mode !== 'host' || !this.isNative) return
      try {
        await LanTcpService.sendJson({ t: 'PING', at: nowIso() })
      } catch (e) {}
    }, HEARTBEAT_INTERVAL)
  }

  // ═══════════════════════════════════════════════════════════════
  //  WORKER
  // ═══════════════════════════════════════════════════════════════
  async connectWorker({ joinPayload, name, onJob } = {}) {
    await this.stop()
    this._stopped = false
    this.mode = 'worker'
    this.onJob = onJob || null
    this._workerName = (name || uniqName()).trim()
    this._joinPayload = joinPayload  // save for auto-reconnect

    if (!this.isNative) {
      this._workerId = `W-local-${Date.now()}`
      return { ok: true, host: 'localStorage', port: 0, name: this._workerName, mode: 'local' }
    }

    return await this._doConnect()
  }

  async _doConnect() {
    const host = this._joinPayload?.hostIp
    if (!host) throw new Error('Missing host IP in QR/JSON')
    const port = this._joinPayload?.port || this.port

    await LanTcpService.connectToGroupOwner({ host, port, retries: 5 })

    this._wire()
    this._startWorkerHeartbeat()

    await new Promise(r => setTimeout(r, 300))
    await LanTcpService.sendJson({
      t: 'HELLO',
      role: 'worker',
      name: this._workerName,
      at: nowIso(),
    })

    return { ok: true, host, port, name: this._workerName }
  }

  // Worker heartbeat: send PONG back when PING received, detect silence
  _startWorkerHeartbeat() {
    this._clearTimers()
    let lastPing = Date.now()

    // Watch for silence: if no PING for 2 intervals, reconnect
    this._heartbeatTimer = setInterval(() => {
      if (this.mode !== 'worker' || this._stopped) return
      const silence = Date.now() - lastPing
      if (silence > HEARTBEAT_INTERVAL * 2 + 5000) {
        console.log('[Dispatch] Host silent, reconnecting...')
        this._scheduleReconnect()
      }
    }, HEARTBEAT_INTERVAL)

    // Store lastPing updater so _handleWorkerMessage can call it
    this._updateLastPing = () => { lastPing = Date.now() }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this._stopped) return
    this._clearTimers()
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null
      if (this._stopped || this.mode !== 'worker') return
      try {
        this._unwire()
        await LanTcpService.disconnectClient()
        console.log('[Dispatch] Attempting reconnect...')
        await this._doConnect()
        console.log('[Dispatch] Reconnected!')
      } catch (e) {
        console.log('[Dispatch] Reconnect failed, retry in 3s', e.message)
        this._scheduleReconnect()
      }
    }, RECONNECT_DELAY)
  }

  _clearTimers() {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null }
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer);  this._reconnectTimer = null }
  }

  // ═══════════════════════════════════════════════════════════════
  //  STOP
  // ═══════════════════════════════════════════════════════════════
  async stop() {
    this._stopped = true
    this._clearTimers()
    this._unwire()

    if (this.isNative) {
      if (this.mode === 'host') {
        try { await LanTcpService.stopServer() } catch (e) {}
      } else if (this.mode === 'worker') {
        try { await LanTcpService.disconnectClient() } catch (e) {}
      }
    }

    this.mode = null
    this.onJob = null
    this.onWorkers = null
    this.workers = []
    this._workerId = null
    this._workerName = null
    this._joinPayload = null
    this._updateLastPing = null
  }

  // ═══════════════════════════════════════════════════════════════
  //  BROADCAST / SEND
  // ═══════════════════════════════════════════════════════════════
  async broadcastNewJob(job) {
    if (this.mode !== 'host' || !this.isNative) return
    await LanTcpService.sendJson({ t: 'NEW_JOB', job })
  }

  async broadcastState(state) {
    if (this.mode !== 'host' || !this.isNative) return
    await LanTcpService.sendJson({ t: 'STATE', state })
  }

  /** @param orders — worker's full orders map after local edits */
  /** @param {{ removedOrderIds?: string[] }} [opts] — order IDs explicitly removed locally (cancellation, checkout, etc.). Host merges deletions reliably. */
  async sendOrdersToHost(orders, opts = {}) {
    if (this.mode !== 'worker' || !this.isNative) return
    const removedOrderIds = Array.isArray(opts.removedOrderIds) ? opts.removedOrderIds : []
    await LanTcpService.sendJson({
      t: 'WORKER_ORDERS',
      orders,
      ...(removedOrderIds.length ? { removedOrderIds } : {}),
    })
  }

  async notifyReady({ orderId, tableId, itemSummary } = {}) {
    if (this.mode !== 'host' || !this.isNative) return
    await LanTcpService.sendJson({ t: 'NOTIFY_READY', orderId, tableId, itemSummary })
  }

  async acceptJob(jobId) {
    if (this.mode !== 'worker') throw new Error('WORKER_MODE_REQUIRED')
    if (!this.isNative) throw new Error('NATIVE_APK_REQUIRED')
    await LanTcpService.sendJson({ t: 'ACCEPT_JOB', jobId, at: nowIso(), workerId: this._workerId })
  }

  async doneJob(jobId) {
    if (this.mode !== 'worker') throw new Error('WORKER_MODE_REQUIRED')
    if (!this.isNative) throw new Error('NATIVE_APK_REQUIRED')
    await LanTcpService.sendJson({ t: 'DONE_JOB', jobId, at: nowIso(), workerId: this._workerId })
  }

  // ═══════════════════════════════════════════════════════════════
  //  INTERNAL WIRING
  // ═══════════════════════════════════════════════════════════════
  _notifyWorkers() {
    if (this.onWorkers) this.onWorkers(this.workers)
  }

  _wire() {
    if (!this.isNative || this._unsubs.length) return

    LanTcpService.addListener('message', (ev) => {
      const base64 = ev?.base64
      if (!base64) return
      let msg
      try { msg = LanTcpService.decodeBase64ToJson(base64) } catch (e) { return }
      if (this.mode === 'host')   this._handleHostMessage(msg, ev?.from)
      else if (this.mode === 'worker') this._handleWorkerMessage(msg)
    }).then(h => this._unsubs.push(h))

    // Host: detect worker disconnect
    LanTcpService.addListener('clientDisconnected', (ev) => {
      if (this.mode !== 'host') return
      const addr = ev?.remoteAddress
      if (addr) {
        this.workers = this.workers.filter(w => w.remoteAddress !== addr)
        this._notifyWorkers()
      }
    }).then(h => this._unsubs.push(h))
  }

  _unwire() {
    const unsubs = this._unsubs
    this._unsubs = []
    for (const h of unsubs) {
      try { h?.remove?.() } catch (e) {}
    }
  }

  async _handleHostMessage(msg, from) {
    if (!msg?.t) return

    if (msg.t === 'HELLO' && msg.role === 'worker') {
      const remoteAddress = from?.remoteAddress || 'worker'
      const id = `W-${remoteAddress.replace(/\./g, '_')}`
      const name = String(msg.name || remoteAddress)
      if (!this.workers.some(w => w.id === id)) {
        this.workers = [...this.workers, { id, name, remoteAddress }]
        this._notifyWorkers()
      }
      await LanTcpService.sendJson({ t: 'WELCOME', workerId: id, at: nowIso() })
      return
    }

    if (msg.t === 'PONG') return  // heartbeat reply, ignore

    if (msg.t === 'WORKER_ORDERS' && msg.orders) {
      if (this.onWorkerOrders) {
        this.onWorkerOrders({
          orders: msg.orders,
          removedOrderIds: Array.isArray(msg.removedOrderIds) ? msg.removedOrderIds : [],
        })
      }
      return
    }

    if (msg.t === 'ACCEPT_JOB' && msg.jobId) {
      if (this.onJobProgress) this.onJobProgress({ kind: 'accept', ...msg })
      return
    }

    if (msg.t === 'DONE_JOB' && msg.jobId) {
      if (this.onJobProgress) this.onJobProgress({ kind: 'done', ...msg })
      return
    }
  }

  _handleWorkerMessage(msg) {
    if (!msg?.t) return

    if (msg.t === 'WELCOME') {
      this._workerId = msg.workerId || this._workerId
      return
    }

    // Heartbeat PING → reply PONG
    if (msg.t === 'PING') {
      if (this._updateLastPing) this._updateLastPing()
      LanTcpService.sendJson({ t: 'PONG', at: nowIso() }).catch(() => {})
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

    if (msg.t === 'NOTIFY_READY') {
      if (this.onReadyNotify) this.onReadyNotify({
        orderId: msg.orderId,
        tableId: msg.tableId,
        itemSummary: msg.itemSummary,
      })
      return
    }
  }
}

export default new DispatchService()
