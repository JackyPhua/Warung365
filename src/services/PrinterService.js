// src/services/PrinterService.js
// Uses Web Bluetooth API (works on Android Chrome + Capacitor)
// Falls back to console mock in desktop browsers

class PrinterService {
  constructor() {
    this.device = null
    this.characteristic = null
    this.connected = false
  }

  get isSupported() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  async scanAndConnect() {
    if (!this.isSupported) {
      console.log('[Printer] Web Bluetooth not supported, using mock mode')
      this.connected = true
      this.device = { name: 'Mock Printer' }
      return { name: 'Mock Printer (Dev)', address: 'mock' }
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Common ESC/POS service
          '0000ff00-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      })

      const server = await device.gatt.connect()
      // Try common ESC/POS UUIDs
      const services = await server.getPrimaryServices()
      let char = null
      for (const service of services) {
        const chars = await service.getCharacteristics()
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            char = c
            break
          }
        }
        if (char) break
      }

      if (!char) throw new Error('No writable characteristic found')

      this.device = device
      this.characteristic = char
      this.connected = true

      device.addEventListener('gattserverdisconnected', () => {
        this.connected = false
      })

      return { name: device.name || 'Unknown', address: device.id }
    } catch (e) {
      console.error('[Printer] Connection failed:', e)
      throw new Error(e.message)
    }
  }

  async disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect()
    }
    this.connected = false
  }

  // ── ESC/POS byte helpers ──
  _enc = new TextEncoder()
  _bytes(str) { return this._enc.encode(str) }

  async _write(data) {
    if (!this.connected) throw new Error('Printer not connected')
    if (!this.characteristic) {
      // Mock mode - log to console
      console.log('[Mock Print]', new TextDecoder().decode(data))
      return
    }
    // Chunked write (BLE max 512 bytes typically)
    const chunkSize = 200
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize)
      await this.characteristic.writeValue(chunk)
      await new Promise(r => setTimeout(r, 30))
    }
  }

  async _sendBuffer(buf) {
    await this._write(buf)
  }

  _concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0)
    const result = new Uint8Array(total)
    let offset = 0
    for (const a of arrays) {
      result.set(a, offset)
      offset += a.length
    }
    return result
  }

  // ESC/POS commands
  _INIT = new Uint8Array([0x1b, 0x40])
  _ALIGN_LEFT = new Uint8Array([0x1b, 0x61, 0x00])
  _ALIGN_CENTER = new Uint8Array([0x1b, 0x61, 0x01])
  _BOLD_ON = new Uint8Array([0x1b, 0x45, 0x01])
  _BOLD_OFF = new Uint8Array([0x1b, 0x45, 0x00])
  _SIZE_NORMAL = new Uint8Array([0x1d, 0x21, 0x00])
  _SIZE_DOUBLE = new Uint8Array([0x1d, 0x21, 0x11])
  _CUT = new Uint8Array([0x1d, 0x56, 0x00])
  _LF = new Uint8Array([0x0a])

  async printTest() {
    const buf = this._concat(
      this._INIT,
      this._ALIGN_CENTER,
      this._SIZE_DOUBLE, this._bytes('POS TEST\n'), this._SIZE_NORMAL,
      this._bytes('Printer OK!\n'),
      this._bytes('80mm Thermal\n'),
      this._bytes('--------------------------------\n'),
      this._LF, this._LF, this._LF,
      this._CUT,
    )
    await this._sendBuffer(buf)
  }

  async printKitchenTicket({ shopName, storeId, tableId, order, t }) {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`

    const parts = [
      this._INIT, this._ALIGN_CENTER, this._SIZE_DOUBLE,
      this._bytes('*** KITCHEN ***\n'),
      this._SIZE_NORMAL, this._ALIGN_LEFT,
      this._bytes('--------------------------------\n'),
      ...(storeId ? [this._bytes(`ID: ${storeId}\n`)] : []),
      this._bytes(`${t('tableNo')}: ${tableId || 'T/A'}   ${timeStr}\n`),
      this._bytes(`${order.type === 'takeaway' ? t('takeaway') : t('dineIn')}\n`),
      this._bytes('--------------------------------\n'),
    ]

    for (const item of order.items) {
      parts.push(this._SIZE_DOUBLE)
      parts.push(this._bytes(`x${item.qty}  ${item.name}\n`))
      parts.push(this._SIZE_NORMAL)
    }

    parts.push(this._bytes('--------------------------------\n'))
    parts.push(this._LF, this._LF, this._LF)
    parts.push(this._CUT)

    await this._sendBuffer(this._concat(...parts))
  }

  async printReceipt({ shopName, storeId, tableId, order, payment, t }) {
    const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0)
    const total = subtotal
    const change = payment.received - total
    const now = new Date()
    const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`
    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`

    const parts = [
      this._INIT, this._ALIGN_CENTER, this._SIZE_DOUBLE,
      this._bytes(shopName + '\n'),
      this._SIZE_NORMAL, this._ALIGN_LEFT,
      this._bytes('--------------------------------\n'),
      ...(storeId ? [this._bytes(`ID: ${storeId}\n`)] : []),
      this._bytes(`${dateStr}  ${timeStr}\n`),
      this._bytes(`${t('tableNo')}: ${tableId || 'T/A'}\n`),
      this._bytes(`#${order.id.substring(0, 8).toUpperCase()}\n`),
      this._bytes('--------------------------------\n'),
    ]

    for (const item of order.items) {
      const subtotal = (item.price * item.qty).toFixed(2)
      const left = `${item.qty}x ${item.name}`.substring(0, 22).padEnd(22)
      parts.push(this._bytes(`${left}RM${subtotal}\n`))
    }

    parts.push(this._bytes('--------------------------------\n'))
    parts.push(this._BOLD_ON, this._SIZE_DOUBLE)
    parts.push(this._bytes(`TOTAL  RM${total.toFixed(2)}\n`))
    parts.push(this._SIZE_NORMAL, this._BOLD_OFF)
    parts.push(this._bytes(`${t('received')}: RM${payment.received.toFixed(2)}\n`))
    parts.push(this._bytes(`${t('change')}: RM${Math.max(0, change).toFixed(2)}\n`))
    parts.push(this._bytes('--------------------------------\n'))
    parts.push(this._ALIGN_CENTER)
    parts.push(this._bytes(t('thankYou') + '\n'))
    parts.push(this._LF, this._LF, this._LF)
    parts.push(this._CUT)

    await this._sendBuffer(this._concat(...parts))
  }
}

export default new PrinterService()
