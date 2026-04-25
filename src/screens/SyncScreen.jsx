// src/screens/SyncScreen.jsx
import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { useApp } from '../context/AppContext'
import DispatchService from '../services/DispatchService'

export default function SyncScreen({ onNavigate }) {
  const { state, dispatch, t } = useApp()
  const normalizedMode = state.serverMode === 'sub' ? 'worker' : (state.serverMode || 'main')
  const [mode, setMode] = useState(normalizedMode)
  const [isServerRunning, setIsServerRunning] = useState(false)
  const [isClientConnected, setIsClientConnected] = useState(false)
  const [subIp, setSubIp] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [localIp, setLocalIp] = useState('')

  useEffect(() => {
    if (isServerRunning && localIp) {
      const data = JSON.stringify(DispatchService.getJoinPayload({ shopName: state.shopName, storeId: state.storeId }))
      QRCode.toDataURL(data, {
        width: 240,
        color: { dark: '#6B21A8', light: '#FFFFFF' },
      }).then(setQrDataUrl)
    }
  }, [isServerRunning, localIp, state.shopName, state.storeId])

  const startMain = async () => {
    try {
      const r = await DispatchService.startHost({
        shopName: state.shopName,
        storeId: state.storeId,
        onWorkers: (list) => dispatch({ type: 'SET_CONNECTED_CLIENTS', payload: list.map(w => `${w.name} (${w.remoteAddress})`) }),
      })
      // Keep UI compatible: show fixed GO gateway in native, or demo IP in web.
      setLocalIp(DispatchService.isNative ? '192.168.49.1' : '192.168.1.100')
      setIsServerRunning(true)
      dispatch({ type: 'SET_SERVER_MODE', payload: 'main' })
    } catch (e) {
      alert('❌ ' + e.message)
    }
  }

  const stopMain = () => {
    DispatchService.stop()
    setIsServerRunning(false)
    dispatch({ type: 'SET_CONNECTED_CLIENTS', payload: [] })
  }

  const connectWorker = () => onNavigate('workerJoin')
  const disconnectWorker = async () => {
    await DispatchService.stop()
    setIsClientConnected(false)
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
        <div style={styles.title}>📡 {t('syncDevices')}</div>
        <div style={{ width: 70 }} />
      </div>

      <div style={styles.scroll}>
        <div style={styles.modeRow}>
          <button
            style={{
              ...styles.modeBtn,
              background: mode === 'main' ? 'var(--grad-primary)' : 'var(--bg-card)',
              color: mode === 'main' ? '#FFFFFF' : 'var(--text)',
              borderColor: mode === 'main' ? 'var(--primary)' : 'var(--border)',
              boxShadow: mode === 'main' ? 'var(--shadow-purple)' : 'var(--shadow-sm)',
            }}
            onClick={() => setMode('main')}
          >
            <div style={{ fontSize: 28 }}>📟</div>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>{t('mainDevice')}</div>
          </button>
          <button
            style={{
              ...styles.modeBtn,
              background: mode === 'sub' ? 'var(--grad-gold)' : 'var(--bg-card)',
              color: mode === 'sub' ? 'var(--primary-dark)' : 'var(--text)',
              borderColor: mode === 'sub' ? 'var(--gold)' : 'var(--border)',
              boxShadow: mode === 'sub' ? 'var(--shadow-gold)' : 'var(--shadow-sm)',
            }}
            onClick={() => setMode('sub')}
          >
            <div style={{ fontSize: 28 }}>📱</div>
            <div style={{ marginTop: 6, fontWeight: 700, fontSize: 13 }}>{t('subDevice')}</div>
          </button>
        </div>

        {mode === 'main' ? (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>🖥️ {t('mainDevice')}</div>
            <div style={styles.desc}>主机 (平板) 当服务器，工人手机扫码入场开始接单</div>

            {!isServerRunning ? (
              <button style={styles.primaryBtn} onClick={startMain}>▶ Start Server</button>
            ) : (
              <>
                <div style={styles.statusBox}>
                  <div style={{ color: 'var(--success)', fontSize: 14, fontWeight: 700 }}>
                    ● Server Running
                  </div>
                  <div style={{ color: 'var(--text)', fontSize: 15, marginTop: 6, fontWeight: 600 }}>
                    IP: {localIp}:8765
                  </div>
                  <div style={{ color: 'var(--text-light)', fontSize: 12, marginTop: 4 }}>
                    {state.connectedClients.length} {t('deviceCount')} {t('connected')}
                  </div>
                </div>

                {qrDataUrl && (
                  <div style={styles.qrBox}>
                    <div style={{ color: 'var(--primary-dark)', fontSize: 14, fontWeight: 700, marginBottom: 14 }}>
                      📱 {t('scanQR')}
                    </div>
                    <img src={qrDataUrl} alt="QR" style={{ width: 240, height: 240 }} />
                    <div style={{ color: 'var(--primary)', fontSize: 13, marginTop: 10, fontWeight: 600 }}>
                      {localIp}
                    </div>
                  </div>
                )}

                {state.connectedClients.map((c, i) => (
                  <div key={i} style={styles.clientRow}>
                    <span style={{ color: 'var(--success)' }}>●</span>
                    <span style={{ color: 'var(--text)', fontSize: 13 }}>{c}</span>
                  </div>
                ))}

                <button style={styles.dangerBtn} onClick={stopMain}>⏹ Stop</button>
              </>
            )}
          </div>
        ) : (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📱 工人手机</div>
            <div style={styles.desc}>扫码主机入场码 → 自动连接 → 进入接单页面</div>

            {!isClientConnected ? (
              <button
                style={{ ...styles.primaryBtn, background: 'var(--grad-gold)', color: 'var(--primary-dark)', boxShadow: 'var(--shadow-gold)' }}
                onClick={connectWorker}
              >
                📷 扫码入场
              </button>
            ) : (
              <>
                <div style={styles.statusBox}>
                  <div style={{ color: 'var(--success)', fontSize: 14, fontWeight: 700 }}>
                    ● {t('connected')}
                  </div>
                </div>
                <button style={styles.dangerBtn} onClick={disconnectWorker}>✂ Disconnect</button>
              </>
            )}
          </div>
        )}

        <div style={styles.infoBox}>
          <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
            ℹ️ Network
          </div>
          <ul style={{ color: 'var(--text-light)', fontSize: 12, lineHeight: 1.9, paddingLeft: 20, margin: 0 }}>
            <li>所有设备连同一 WiFi</li>
            <li>不需要互联网（局域网）</li>
            <li>端口 8765 (TCP)</li>
            <li>断线自动重连</li>
          </ul>
          <div style={{
            marginTop: 10, padding: 10, borderRadius: 8,
            background: 'var(--warning-light)', color: '#92400E', fontSize: 11,
          }}>
            ⚠️ 浏览器模拟模式 — 打包成 APK 后使用原生 TCP 真正同步
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
  },
  backBtn: {
    background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500,
  },
  title: { color: 'var(--text)', fontSize: 16, fontWeight: 700 },
  scroll: { flex: 1, overflow: 'auto', padding: 16 },
  modeRow: { display: 'flex', gap: 12, marginBottom: 14 },
  modeBtn: {
    flex: 1, padding: '18px 10px', borderRadius: 14,
    border: '1.5px solid', textAlign: 'center',
    transition: 'all 0.15s',
  },
  section: {
    background: 'var(--bg-card)', borderRadius: 14,
    padding: 18, marginBottom: 12,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  },
  sectionTitle: { color: 'var(--text)', fontSize: 14, fontWeight: 700, marginBottom: 8 },
  desc: { color: 'var(--text-light)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 },
  primaryBtn: {
    width: '100%', padding: 14,
    background: 'var(--grad-primary)',
    color: '#FFFFFF', borderRadius: 12, fontSize: 15, fontWeight: 700,
    boxShadow: 'var(--shadow-purple)',
  },
  dangerBtn: {
    width: '100%', padding: 12, marginTop: 10,
    background: 'var(--danger-light)', color: 'var(--danger)',
    borderRadius: 12, fontSize: 14, fontWeight: 600,
    border: '1px solid var(--danger)',
  },
  statusBox: {
    background: 'var(--success-light)', borderRadius: 10, padding: 14, marginBottom: 12,
    border: '1px solid var(--success)',
  },
  qrBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: 'var(--bg)', borderRadius: 14, padding: 20, marginBottom: 12,
    border: '1px solid var(--border)',
  },
  clientRow: {
    display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8,
    padding: '8px 12px', background: 'var(--bg)', borderRadius: 8,
  },
  label: { display: 'block', color: 'var(--text-light)', fontSize: 12, marginBottom: 6, fontWeight: 600 },
  input: {
    width: '100%', background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: '12px 14px', fontSize: 16,
    color: 'var(--text)', boxSizing: 'border-box',
    marginBottom: 12,
  },
  infoBox: {
    background: 'var(--bg-card)',
    borderRadius: 14, padding: 16,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  },
}
