// src/screens/WorkerJoinScreen.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useApp } from '../context/AppContext'
import DispatchService from '../services/DispatchService'

export default function WorkerJoinScreen({ onNavigate }) {
  const { t, dispatch } = useApp()
  const videoRef = useRef(null)
  const nameInputRef = useRef(null)
  const codeReaderRef = useRef(null)
  const [status, setStatus] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [workerName, setWorkerName] = useState('')
  const [scanning, setScanning] = useState(false)
  /** Remount <input> after scan so WebView/IME don't show ghost or stale text */
  const [nameFieldKey, setNameFieldKey] = useState(0)

  /** Must stop tracks — some OEM WebViews keep camera "open" and block keyboard on <input> */
  const stopAllCameraTracks = () => {
    const v = videoRef.current
    const stream = v?.srcObject
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((t) => { try { t.stop() } catch (_) {} })
    }
    if (v) {
      try { v.srcObject = null } catch (_) {}
    }
  }

  const focusNameInputHard = () => {
    const el = nameInputRef.current
    if (!el) return
    // Avoid readOnly toggling — on some phones it leaves IME text out of sync with React value
    el.focus()
    try {
      const len = el.value.length
      el.setSelectionRange(len, len)
    } catch (_) {}
  }

  const focusNameInputAfterScan = () => {
    ;[120, 450, 900].forEach((ms) => setTimeout(() => focusNameInputHard(), ms))
  }

  useEffect(() => {
    setTimeout(() => nameInputRef.current?.focus(), 400)
    return () => {
      try { codeReaderRef.current?.reset?.() } catch (_) {}
      stopAllCameraTracks()
    }
  }, [])

  const startScan = async () => {
    if (scanning) return
    const codeReader = new BrowserMultiFormatReader()
    codeReaderRef.current = codeReader
    setScanning(true)
    setStatus('📷 Opening camera...')
    try {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current)
      const text = result?.getText?.() || ''
      setJsonText(text)
      setWorkerName('')
      setNameFieldKey((k) => k + 1)
      setStatus('✅ QR decoded — type name below then connect')
    } catch (e) {
      setStatus('❌ Camera: ' + (e?.message || String(e)))
    } finally {
      setScanning(false)
      try { codeReaderRef.current?.reset?.() } catch (_) {}
      stopAllCameraTracks()
      focusNameInputAfterScan()
    }
  }

  const joinPayload = useMemo(() => {
    try {
      const p = JSON.parse((jsonText || '').trim())
      return p && typeof p === 'object' ? p : null
    } catch {
      return null
    }
  }, [jsonText])

  const [connecting, setConnecting] = useState(false)

  const doJoin = async () => {
    try {
      if (!joinPayload || joinPayload.t !== 'WORKER_JOIN') {
        alert('⚠️ Invalid QR/JSON')
        return
      }
      setConnecting(true)
      setStatus('🔗 Requesting permissions...')
      await new Promise(r => setTimeout(r, 200))

      setStatus('🔌 Connecting to host on Wi‑Fi (TCP)...')
      await DispatchService.connectWorker({
        joinPayload,
        name: workerName.trim() || undefined,
        onJob: (job) => onNavigate('workerJobs', { job }),
      })
      if (joinPayload.language) dispatch({ type: 'SET_LANGUAGE', payload: joinPayload.language })
      dispatch({ type: 'SET_SERVER_MODE', payload: 'sub' })
      setStatus('✅ Connected!')
      setConnecting(false)
      onNavigate('tables')
    } catch (e) {
      setConnecting(false)
      setStatus('❌ ' + (e?.message || String(e)))
    }
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('sync')}>← {t('back')}</button>
        <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 800 }}>📲 {t('scanToJoin')}</div>
        <div style={{ width: 70 }} />
      </div>

      <div style={S.scroll}>
        {!DispatchService.isNative && (
          <div style={S.warn}>
            ⚠️ {t('wifiDirectUnavail')}
          </div>
        )}

        {/* Camera section FIRST — user scans QR, then immediately sees name input below */}
        <div style={S.section}>
          <div style={S.sectionTitle}>📷 {t('cameraScan')}</div>
          {/* Single <video> — switching two nodes broke ref + camera release on some phones */}
          <video
            ref={videoRef}
            style={{ ...S.video, display: scanning ? 'block' : 'none' }}
            muted
            playsInline
            autoPlay
          />
          {!scanning && (
            <button
              style={{ ...S.primaryBtn, marginTop: 0, background: 'var(--grad-gold)', color: 'var(--primary-dark)' }}
              onClick={startScan}
            >
              📷 {t('cameraHint')}
            </button>
          )}
          {status && <div style={{ marginTop: 10, color: 'var(--text)', fontSize: 12 }}>{status}</div>}
        </div>

        {/* Name input — form stops Android autofill putting saved "names" into this field */}
        <form style={S.section} autoComplete="off" onSubmit={(e) => e.preventDefault()}>
          <div style={S.sectionTitle}>👤 {t('workerName')}（{t('optional')}）</div>
          <input
            key={nameFieldKey}
            ref={nameInputRef}
            type="text"
            inputMode="text"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            name={`w365-worker-${nameFieldKey}`}
            id={`w365-worker-${nameFieldKey}`}
            style={S.input}
            value={workerName}
            onChange={(e) => setWorkerName(e.target.value)}
            onInput={(e) => setWorkerName(e.currentTarget.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => {
              e.stopPropagation()
              focusNameInputHard()
            }}
            onClick={(e) => {
              e.stopPropagation()
              focusNameInputHard()
            }}
          />
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>{t('workerNameHint')}</div>
          <button type="button" style={S.focusHelpBtn} onClick={() => focusNameInputHard()}>
            ⌨️ {t('tapToTypeName')}
          </button>
        </form>

        <div style={S.section}>
          <div style={S.sectionTitle}>🧾 {t('joinJson')}</div>
          <textarea
            style={S.textarea}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder={'{ "t": "WORKER_JOIN", "storeId": "STORE-001", "port": 8765 }'}
            rows={6}
          />
          <button style={{ ...S.primaryBtn, opacity: connecting ? 0.6 : 1 }} onClick={doJoin} disabled={connecting}>
            {connecting ? '⏳ ...' : '🔗'} {t('connectHost')}
          </button>
          {status.startsWith('❌') && (
            <button style={{ ...S.primaryBtn, marginTop: 8, background: 'var(--grad-gold)', color: 'var(--primary-dark)' }} onClick={doJoin}>
              🔄 {t('retry') || 'Retry'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  backBtn: { background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 10, fontSize: 14 },
  // Use overflowY:'scroll' not 'auto' — Android WebView handles scroll+input better with 'scroll'
  scroll: { flex: 1, overflowY: 'scroll', WebkitOverflowScrolling: 'touch', padding: 16 },
  warn: { background: 'var(--warning-light)', border: '1px solid var(--warning)', color: '#92400E', padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 12, lineHeight: 1.6 },
  section: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { color: 'var(--text)', fontSize: 13, fontWeight: 800, marginBottom: 10 },
  input: {
    display: 'block',
    width: '100%',
    background: 'var(--bg-input)',
    border: '2px solid var(--primary)',
    borderRadius: 10,
    padding: '14px 14px',
    fontSize: 18,
    color: 'var(--text)',
    boxSizing: 'border-box',
    WebkitUserSelect: 'text',
    userSelect: 'text',
  },
  video: { width: '100%', borderRadius: 12, objectFit: 'cover', border: '1px solid var(--border)' },
  textarea: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontSize: 13, color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical', fontFamily: "'Courier New', Courier, monospace" },
  primaryBtn: { width: '100%', marginTop: 10, padding: 14, background: 'var(--grad-primary)', color: '#FFFFFF', borderRadius: 12, fontSize: 15, fontWeight: 800, boxShadow: 'var(--shadow-purple)' },
  focusHelpBtn: {
    width: '100%',
    marginTop: 10,
    padding: '12px 14px',
    background: 'var(--bg-lighter)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
  },
}
