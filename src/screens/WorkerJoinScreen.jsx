// src/screens/WorkerJoinScreen.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useApp } from '../context/AppContext'
import DispatchService from '../services/DispatchService'

export default function WorkerJoinScreen({ onNavigate }) {
  const { t, dispatch } = useApp()
  const videoRef = useRef(null)
  const codeReaderRef = useRef(null)
  const [status, setStatus] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [workerName, setWorkerName] = useState('')

  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    return () => {
      try { codeReaderRef.current?.reset?.() } catch (_) {}
    }
  }, [])

  const startScan = async () => {
    if (scanning) return
    const codeReader = new BrowserMultiFormatReader()
    codeReaderRef.current = codeReader
    setScanning(true)
    setStatus('📷 Opening camera...')
    try {
      // Ensure <video> is mounted before starting camera
      await new Promise(r => requestAnimationFrame(() => r()))
      await new Promise(r => requestAnimationFrame(() => r()))
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current)
      const text = result?.getText?.() || ''
      setJsonText(text)
      setStatus('✅ QR decoded')
    } catch (e) {
      setStatus('❌ Camera: ' + (e?.message || String(e)))
    } finally {
      setScanning(false)
      try { codeReaderRef.current?.reset?.() } catch (_) {}
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

      setStatus('🔍 Discovering host device (up to 15s)...')
      await DispatchService.connectWorker({
        joinPayload,
        name: workerName.trim() || undefined,
        onJob: (job) => onNavigate('workerJobs', { job }),
      })
      // Adopt host's language so UI matches
      if (joinPayload.language) dispatch({ type: 'SET_LANGUAGE', payload: joinPayload.language })
      // Mark this device as worker so AppContext sync effects activate
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

        <div style={S.section}>
          <div style={S.sectionTitle}>👤 {t('workerName')}（{t('optional')}）</div>
          <input
            type="text"
            autoComplete="off"
            style={S.input}
            value={workerName}
            onChange={e => setWorkerName(e.target.value)}
            placeholder="Worker-01"
          />
        </div>

        <div style={S.section}>
          <div style={S.sectionTitle}>📷 {t('cameraScan')}</div>
          <div style={S.videoBox}>
            <video ref={videoRef} style={S.video} muted playsInline />
            {!scanning && (
              <div style={S.videoOverlay}>
                <button
                  style={{ ...S.primaryBtn, marginTop: 0, background: 'var(--grad-gold)', color: 'var(--primary-dark)', width: '100%' }}
                  onClick={startScan}
                >
                  📷 {t('cameraHint')}
                </button>
              </div>
            )}
          </div>
          {status && <div style={{ marginTop: 10, color: 'var(--text)', fontSize: 12 }}>{status}</div>}
        </div>

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
  scroll: { flex: 1, overflow: 'auto', padding: 16 },
  warn: { background: 'var(--warning-light)', border: '1px solid var(--warning)', color: '#92400E', padding: 12, borderRadius: 10, marginBottom: 12, fontSize: 12, lineHeight: 1.6 },
  section: { position: 'relative', zIndex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 12 },
  sectionTitle: { color: 'var(--text)', fontSize: 13, fontWeight: 800, marginBottom: 10 },
  input: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 16,
    color: 'var(--text)',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    touchAction: 'manipulation',
    WebkitUserSelect: 'text',
    userSelect: 'text',
  },
  videoBox: { position: 'relative', width: '100%', aspectRatio: '16/10', background: '#000', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' },
  video: { width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' },
  videoOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    background: 'rgba(0,0,0,0.35)',
    pointerEvents: 'auto',
  },
  textarea: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, fontSize: 13, color: 'var(--text)', boxSizing: 'border-box', resize: 'vertical', fontFamily: "'Courier New', Courier, monospace" },
  primaryBtn: { width: '100%', marginTop: 10, padding: 14, background: 'var(--grad-primary)', color: '#FFFFFF', borderRadius: 12, fontSize: 15, fontWeight: 800, boxShadow: 'var(--shadow-purple)' },
}

