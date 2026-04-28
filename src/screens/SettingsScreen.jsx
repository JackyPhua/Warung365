// src/screens/SettingsScreen.jsx
import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import PrinterService from '../services/PrinterService'
import LicenseService from '../services/LicenseService'

const DEV_PASSWORD = 'dev2024'

export default function SettingsScreen({ onNavigate }) {
  const { state, dispatch, t } = useApp()
  const [devUnlocked, setDevUnlocked] = useState(false)
  const [devPassword, setDevPassword] = useState('')
  const [devError, setDevError] = useState('')
  const [shopName, setShopName] = useState(state.shopName)
  const [storeId, setStoreId] = useState(state.storeId || '')
  const [licenseKey, setLicenseKey] = useState('')
  const [cookingPrices, setCookingPrices] = useState({ ...state.cookingMethodPrices })
  const [tableCount, setTableCount] = useState(state.tableCount)
  const [showImportConfig, setShowImportConfig] = useState(false)
  const [importText, setImportText] = useState('')

  const langs = [
    { id: 'zh', label: '中文', flag: '🇨🇳' },
    { id: 'en', label: 'English', flag: '🇬🇧' },
    { id: 'ms', label: 'Melayu', flag: '🇲🇾' },
  ]

  const methods = [
    { id: 'dine_in', key: 'dineIn', icon: '🍽️' },
    { id: 'takeaway', key: 'takeaway', icon: '📦' },
    { id: 'extra', key: 'extraIngredient', icon: '➕' },
    { id: 'extra_takeaway', key: 'extraTakeaway', icon: '📦➕' },
  ]

  const tryDevUnlock = () => {
    if (devPassword === DEV_PASSWORD) { setDevUnlocked(true); setDevError('') }
    else setDevError(t('wrongPassword'))
  }

  const activateLicense = () => {
    const result = LicenseService.validateKey(licenseKey)
    if (result.valid) {
      dispatch({ type: 'SET_LICENSE', payload: { key: result.key, type: result.type, expiry: result.expiry } })
      alert(`✅ ${t('success')} — 30 days`); setLicenseKey('')
    } else alert(`❌ Invalid key`)
  }

  const importConfig = () => {
    const raw = (importText || '').trim()
    if (!raw) { alert('⚠️ Empty'); return }
    try {
      const parsed = JSON.parse(raw)
      const nextStoreId = String(parsed.storeId ?? parsed.shopId ?? parsed.store_id ?? '').trim()
      const nextShopName = String(parsed.shopName ?? parsed.shop ?? '').trim()

      if (nextStoreId) {
        dispatch({ type: 'SET_STORE_ID', payload: nextStoreId })
        setStoreId(nextStoreId)
      }
      if (nextShopName) {
        dispatch({ type: 'SET_SHOP_NAME', payload: nextShopName })
        setShopName(nextShopName)
      }

      if (!nextStoreId && !nextShopName) {
        alert('⚠️ No storeId/shopName in JSON')
        return
      }

      setShowImportConfig(false)
      setImportText('')
      alert('✅')
    } catch (e) {
      alert('JSON error: ' + e.message)
    }
  }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
        <div style={{ color: 'var(--gold)', fontSize: 16, fontWeight: 700 }}>⚙️ {t('settings')}</div>
        <div style={{ width: 70 }} />
      </div>

      <div style={S.scroll}>
        {/* License - everyone sees this */}
        <Section title={t('license')} icon="🔑">
          <div style={S.statusBox}>
            <div style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700 }}>
              {state.licenseType === 'trial' ? `⏱️ ${t('trial')}` : `✅ ${t('monthly')}`}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
              {t('expired')}: {state.licenseExpiry ? new Date(state.licenseExpiry).toLocaleDateString() : '-'}
            </div>
          </div>
          <div style={S.inputRow}>
            <input style={S.input} value={licenseKey}
              onChange={e => setLicenseKey(e.target.value.toUpperCase())}
              placeholder="POS-XXXX-XXXX-XXXX" />
            <button style={S.goldBtn} onClick={activateLicense}>{t('activate')}</button>
          </div>
        </Section>

        {!devUnlocked && (
          <Section title={t('deviceRole')} icon="👤">
            <div style={{
              padding: 14, borderRadius: 12, background: 'var(--bg-lighter)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                {state.deviceRole === 'cashier' ? `💰 ${t('cashierRole')}` : `🍽️ ${t('waiterRole')}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                {state.deviceRole === 'cashier' ? t('cashierDesc') : t('waiterDesc')}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              {t('devRoleChangeHint')}
            </div>
          </Section>
        )}

        {/* Dev gate */}
        {!devUnlocked ? (
          <Section title={t('devSettings')} icon="🔒">
            <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>
              {t('devPasswordHint')}
            </div>
            <div style={S.inputRow}>
              <input type="password" style={{
                ...S.input, textAlign: 'center', letterSpacing: 4,
                borderColor: devError ? 'var(--danger)' : 'var(--border)',
              }}
                value={devPassword}
                onChange={e => { setDevPassword(e.target.value); setDevError('') }}
                onKeyDown={e => e.key === 'Enter' && tryDevUnlock()}
                placeholder={t('enterPassword')} />
              <button style={S.goldBtn} onClick={tryDevUnlock}>🔓</button>
            </div>
            {devError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8, fontWeight: 600 }}>{devError}</div>}
          </Section>
        ) : (
          <>
            <div style={S.unlockedBanner}>🔓 {t('devUnlocked')}</div>

            <Section title={t('devEmployeeCheckout')} icon="💳">
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                {t('devEmployeeCheckoutHint')}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { id: 'cashier', label: t('cashierRole'), desc: t('cashierDesc'), icon: '💰' },
                  { id: 'waiter', label: t('waiterRole'), desc: t('waiterDesc'), icon: '🍽️' },
                ].map(role => {
                  const active = state.deviceRole === role.id
                  return (
                    <button key={role.id} type="button" onClick={() => dispatch({ type: 'SET_DEVICE_ROLE', payload: role.id })} style={{
                      flex: 1, padding: 16, borderRadius: 14, textAlign: 'center',
                      border: active ? '2px solid var(--primary)' : '2px solid var(--border)',
                      background: active ? 'var(--primary-light)' : 'var(--bg-lighter)',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ fontSize: 28 }}>{role.icon}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: active ? 'var(--primary)' : 'var(--text)', marginTop: 6 }}>
                        {role.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
                        {role.desc}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section title={t('shopName')} icon="🏪">
              <div style={S.inputRow}>
                <input style={S.input} value={shopName} onChange={e => setShopName(e.target.value)} />
                <button style={S.saveBtn} onClick={() => { dispatch({ type: 'SET_SHOP_NAME', payload: shopName }); alert('✅') }}>{t('save')}</button>
              </div>
            </Section>

            <Section title={t('storeId')} icon="🆔">
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 10 }}>
                {t('storeIdHint')}
              </div>
              <div style={S.inputRow}>
                <input style={S.input} value={storeId} onChange={e => setStoreId(e.target.value)} placeholder="STORE-001" />
                <button style={S.saveBtn} onClick={() => { dispatch({ type: 'SET_STORE_ID', payload: storeId.trim() }); alert('✅') }}>{t('save')}</button>
              </div>
              <button style={{ ...S.flexBtn, marginTop: 10 }} onClick={() => { setShowImportConfig(true); setImportText('') }}>
                📥 {t('importConfig')}
              </button>
            </Section>

            <Section title={t('language')} icon="🌐">
              <div style={{ display: 'flex', gap: 8 }}>
                {langs.map(l => (
                  <button key={l.id} onClick={() => dispatch({ type: 'SET_LANGUAGE', payload: l.id })} style={{
                    ...S.langBtn,
                    background: state.language === l.id ? 'var(--grad-primary)' : 'var(--bg-lighter)',
                    color: state.language === l.id ? '#FFFFFF' : 'var(--text)',
                    borderColor: state.language === l.id ? 'var(--primary)' : 'var(--border)',
                  }}>
                    <div style={{ fontSize: 22 }}>{l.flag}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{l.label}</div>
                  </button>
                ))}
              </div>
            </Section>

            <Section title={t('menuManage')} icon="📋">
              <button onClick={() => onNavigate('menuManager')} style={{
                width: '100%', padding: 14, background: 'var(--grad-primary)',
                color: '#FFFFFF', borderRadius: 12, fontSize: 15, fontWeight: 700,
                boxShadow: 'var(--shadow-purple)',
              }}>✏️ {t('editMenu')} →</button>
            </Section>

            <Section title={t('tableNo')} icon="🪑">
              <div style={S.inputRow}>
                <input style={S.input} type="number" value={tableCount}
                  onChange={e => setTableCount(e.target.value)} min={1} max={100} />
                <button style={S.saveBtn} onClick={() => {
                  const n = parseInt(tableCount)
                  if (n > 0 && n <= 100) { dispatch({ type: 'SET_TABLE_COUNT', payload: n }); alert('✅') }
                }}>{t('save')}</button>
              </div>
            </Section>

            <Section title={`${t('price')} · ${t('dineIn')} / ${t('takeaway')}`} icon="💰">
              {methods.map(m => (
                <div key={m.id} style={S.priceRow}>
                  <span style={{ fontSize: 18, marginRight: 8 }}>{m.icon}</span>
                  <span style={{ flex: 1, color: 'var(--text)', fontSize: 14 }}>{t(m.key)}</span>
                  <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>RM +</span>
                  <input style={S.priceInput} type="number" step="0.1"
                    value={cookingPrices[m.id]}
                    onChange={e => setCookingPrices({ ...cookingPrices, [m.id]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
              <button style={S.saveFullBtn} onClick={() => { dispatch({ type: 'SET_COOKING_PRICES', payload: cookingPrices }); alert('✅') }}>
                {t('save')}
              </button>
            </Section>

            <Section title={t('printer')} icon="🖨️">
              <div style={S.statusBox}>
                <span style={{ color: state.printerConnected ? 'var(--success)' : 'var(--danger)', fontSize: 14, fontWeight: 600 }}>
                  {state.printerConnected ? `● ${t('connected')}` : `● ${t('disconnected')}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.flexBtn} onClick={async () => {
                  try {
                    const r = await PrinterService.scanAndConnect()
                    dispatch({ type: 'SET_PRINTER', payload: { address: r.address, connected: true } })
                    alert('✅ ' + r.name)
                  } catch (e) { alert('❌ ' + e.message) }
                }}>🔍 {t('connectPrinter')}</button>
                {state.printerConnected && (
                  <button style={{ ...S.flexBtn, background: 'var(--success)', color: '#FFF' }}
                    onClick={async () => { try { await PrinterService.printTest(); alert('✅') } catch (e) { alert('❌ ' + e.message) } }}>
                    {t('printTest')}</button>
                )}
              </div>
            </Section>
          </>
        )}
      </div>

      {showImportConfig && (
        <div onClick={() => setShowImportConfig(false)} style={M.overlay}>
          <div onClick={e => e.stopPropagation()} style={M.box}>
            <h3 style={{ color: 'var(--primary)', fontSize: 16, margin: '0 0 12px', textAlign: 'center', fontWeight: 700 }}>
              📥 {t('importConfig')}
            </h3>
            <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
              {t('importConfigHint')}
            </div>
            <textarea
              style={M.textarea}
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder={'{\n  "storeId": "STORE-001",\n  "shopName": "Warung365"\n}'}
              rows={6}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={M.cancelBtn} onClick={() => setShowImportConfig(false)}>{t('cancel')}</button>
              <button style={M.importBtn} onClick={importConfig}>✓ {t('import')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}><span style={{ fontSize: 18, marginRight: 8 }}>{icon}</span>{title}</div>
      {children}
    </div>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  backBtn: {
    background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 14,
  },
  scroll: { flex: 1, overflow: 'auto', padding: 16 },
  section: {
    background: 'var(--bg-card)', borderRadius: 14, padding: 16, marginBottom: 12,
    border: '1px solid var(--border)',
  },
  sectionTitle: { color: 'var(--text)', fontSize: 14, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center' },
  unlockedBanner: {
    background: 'var(--primary-light)', border: '1px solid var(--primary)',
    borderRadius: 10, padding: '10px 16px', marginBottom: 12,
    color: 'var(--primary)', fontSize: 13, fontWeight: 600, textAlign: 'center',
  },
  inputRow: { display: 'flex', gap: 10 },
  input: {
    flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)',
  },
  saveBtn: {
    background: 'var(--grad-primary)', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
  },
  goldBtn: {
    background: 'var(--grad-gold)', color: 'var(--text)',
    padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800,
    boxShadow: 'var(--shadow-gold)',
  },
  saveFullBtn: {
    width: '100%', marginTop: 10, background: 'var(--grad-primary)',
    color: '#FFFFFF', padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 700,
  },
  langBtn: {
    flex: 1, padding: '14px 10px', borderRadius: 12, border: '1.5px solid', textAlign: 'center',
  },
  priceRow: { display: 'flex', alignItems: 'center', marginBottom: 10, padding: '8px 0' },
  priceInput: {
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '8px 10px', fontSize: 14, width: 80, textAlign: 'right', color: 'var(--text)',
  },
  statusBox: { background: 'var(--bg-lighter)', borderRadius: 10, padding: 12, marginBottom: 10 },
  flexBtn: {
    flex: 1, background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: 12, borderRadius: 10, fontSize: 13, fontWeight: 600,
  },
}

const M = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.15s',
  },
  box: {
    width: '100%', maxWidth: 520, background: 'var(--bg-card)',
    borderRadius: '20px 20px 0 0', padding: 18, animation: 'slideUp 0.25s',
    borderTop: '3px solid var(--primary)',
  },
  textarea: {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '12px 12px',
    fontSize: 13,
    color: 'var(--text)',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: "'Courier New', Courier, monospace",
  },
  cancelBtn: {
    flex: 1, padding: 12, background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 10, fontSize: 14,
  },
  importBtn: {
    flex: 1, padding: 12, background: 'var(--grad-primary)', color: '#FFFFFF',
    borderRadius: 10, fontSize: 14, fontWeight: 700,
  },
}
