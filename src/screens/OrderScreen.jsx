// src/screens/OrderScreen.jsx
import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../context/AppContext'
import PrinterService from '../services/PrinterService'
import SoundService from '../services/SoundService'
import DispatchService from '../services/DispatchService'

export default function OrderScreen({ orderId, tableId, onNavigate }) {
  const { state, dispatch, t, getOrderTotal } = useApp()
  const isWaiter = state.deviceRole === 'waiter'
  // Workers can checkout takeaway orders (tableId===0) but not dine-in tables
  const canCheckout = !isWaiter || tableId === 0
  const [showCheckout, setShowCheckout] = useState(false)
  const [showReceipt, setShowReceipt] = useState(null) // { order, payment } or null
  const [editingNote, setEditingNote] = useState(null)
  const [noteText, setNoteText] = useState('')
  const order = state.orders[orderId]
  const total = getOrderTotal(orderId)
  const lang = state.language

  if (!order) return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
      </div>
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('noItems')}</div>
    </div>
  )

  const handleQty = (itemId, qty) => {
    if (qty <= 0) {
      if (confirm(t('deleteItem') + '?')) {
        dispatch({ type: 'REMOVE_ITEM', payload: { orderId, itemId } })
        SoundService.errorSound()
      }
      return
    }
    dispatch({ type: 'UPDATE_ITEM_QTY', payload: { orderId, itemId, qty } })
    SoundService.tapSound()
  }

  const handleRepeat = (item) => {
    dispatch({ type: 'ADD_ITEM_TO_ORDER', payload: { orderId, item: { ...item, id: uuidv4() } } })
    SoundService.orderSound()
  }

  const startEditNote = (item) => { setEditingNote(item.id); setNoteText(item.note || '') }
  const saveNote = (itemId) => {
    dispatch({
      type: 'UPDATE_ORDER',
      payload: { ...order, items: order.items.map(i => i.id === itemId ? { ...i, note: noteText.trim() } : i) },
    })
    setEditingNote(null)
  }

  const quickNotes = [
    { zh: '不要辣', en: 'No Spicy', ms: 'Tak Pedas' },
    { zh: '加蛋', en: 'Add Egg', ms: 'Tambah Telur' },
    { zh: '少油', en: 'Less Oil', ms: 'Kurang Minyak' },
    { zh: '加辣', en: 'Extra Spicy', ms: 'Lebih Pedas' },
    { zh: '不要葱', en: 'No Onion', ms: 'Tak Bawang' },
    { zh: '加饭', en: 'Extra Rice', ms: 'Tambah Nasi' },
  ]

  const handleCheckout = async (payment) => {
    setShowCheckout(false)
    SoundService.paymentSound()

    // Show receipt preview BEFORE dispatching (order still exists)
    setShowReceipt({ order: { ...order }, payment, shopName: state.shopName, storeId: state.storeId, tableId })

    dispatch({ type: 'CHECKOUT_ORDER', payload: { orderId, tableId, payment } })

    if (state.printerConnected) {
      try {
        await PrinterService.printKitchenTicket({ shopName: state.shopName, storeId: state.storeId, tableId, order, t })
        await PrinterService.printReceipt({ shopName: state.shopName, storeId: state.storeId, tableId, order, payment, t })
      } catch (e) { alert(t('printer') + ': ' + e.message) }
    }

    // Dispatch to workers (host only)
    if (state.serverMode === 'main') {
      const job = {
        jobId: order.id,
        tableId,
        placedAt: order.createdAt || new Date().toISOString(),
        items: (order.items || []).map(i => ({ name: i.name, qty: i.qty, note: i.note || '' })),
      }
      DispatchService.broadcastNewJob(job).catch(() => {})
    }
  }

  const closeReceipt = () => { setShowReceipt(null); onNavigate('tables') }

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
        <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 700 }}>
          {tableId === 0 ? `📦 ${t('takeaway')}` : `🪑 ${t('tableNo')} ${tableId}`}
        </div>
        <button style={S.addBtn} onClick={() => onNavigate('menu', { tableId, orderId, orderType: order.type })}>
          + {t('addOrder')}
        </button>
      </div>

      <div style={S.itemsScroll}>
        {order.items.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>{t('noItems')}
          </div>
        ) : order.items.map((item, idx) => (
          <div key={item.id} style={S.itemRow}>
            <div style={S.itemIndex}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>{item.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                RM {item.price.toFixed(2)} × {item.qty}
              </div>
              {item.note && <div style={S.noteDisplay}>📝 {item.note}</div>}
            </div>
            <div style={S.qtyGroup}>
              <button style={S.qtyBtn} onClick={() => handleQty(item.id, item.qty - 1)}>−</button>
              <span style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{item.qty}</span>
              <button style={{ ...S.qtyBtn, background: 'var(--primary)', color: '#FFF' }}
                      onClick={() => handleQty(item.id, item.qty + 1)}>+</button>
            </div>
            <div style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 700, minWidth: 65, textAlign: 'right' }}>
              RM {(item.price * item.qty).toFixed(2)}
            </div>
            <div style={S.itemActions}>
              <button style={S.miniBtn} onClick={() => startEditNote(item)}>📝</button>
              <button style={S.miniBtn} onClick={() => handleRepeat(item)}>🔁</button>
              <button style={S.deleteBtnSmall} onClick={() => {
                dispatch({ type: 'REMOVE_ITEM', payload: { orderId, itemId: item.id } }); SoundService.errorSound()
              }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      <div style={S.footer}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: 'var(--text-light)', fontSize: 14 }}>{t('total')}</span>
          <span style={{ color: 'var(--primary)', fontSize: 28, fontWeight: 800 }}>RM {total.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCheckout && (
            <button style={S.cancelBtn} onClick={() => {
              if (confirm(t('cancelOrder') + '?')) {
                dispatch({ type: 'CANCEL_ORDER', payload: { orderId, tableId } }); SoundService.errorSound(); onNavigate('tables')
              }
            }}>{t('cancelOrder')}</button>
          )}
          <button style={S.kitchenBtn} onClick={async () => {
            if (!state.printerConnected) { alert(t('disconnected')); return }
            try { await PrinterService.printKitchenTicket({ shopName: state.shopName, tableId, order, t }); alert('✅') } catch (e) { alert('❌ ' + e.message) }
          }}>🖨️</button>
          {canCheckout ? (
            <button style={{ ...S.checkoutBtn, opacity: order.items.length === 0 ? 0.3 : 1 }}
              onClick={() => { if (order.items.length > 0) setShowCheckout(true) }}>
              💳 {t('checkout')}
            </button>
          ) : (
            <div style={S.waiterHint}>🔒 {t('noCheckoutPermission')}</div>
          )}
        </div>
      </div>

      {/* Note Editor */}
      {editingNote && (
        <div onClick={() => setEditingNote(null)} style={S.modalOverlay}>
          <div onClick={e => e.stopPropagation()} style={S.modalBox}>
            <h3 style={{ color: 'var(--primary)', fontSize: 16, margin: '0 0 12px', textAlign: 'center', fontWeight: 700 }}>
              📝 {t('remarks')}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {quickNotes.map((qn, i) => (
                <button key={i} onClick={() => {
                  const label = qn[lang] || qn.zh
                  setNoteText(prev => prev ? `${prev}, ${label}` : label)
                }} style={S.quickNoteBtn}>{qn[lang] || qn.zh}</button>
              ))}
            </div>
            <textarea autoFocus style={S.noteInput} value={noteText}
              onChange={e => setNoteText(e.target.value)} placeholder={t('enterRemarks')} rows={3} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={S.modalCancelBtn} onClick={() => setEditingNote(null)}>{t('cancel')}</button>
              <button style={S.modalSaveBtn} onClick={() => saveNote(editingNote)}>✓ {t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && <CheckoutModal total={total} t={t} onConfirm={handleCheckout} onClose={() => setShowCheckout(false)} />}

      {/* Receipt Preview */}
      {showReceipt && <ReceiptPreview data={showReceipt} t={t} onClose={closeReceipt} />}
    </div>
  )
}

// ═══ Receipt Preview ═══
function ReceiptPreview({ data, t, onClose }) {
  const { order, payment, shopName, storeId, tableId } = data
  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0)
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB')
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div onClick={onClose} style={R.overlay}>
      <div onClick={e => e.stopPropagation()} style={R.box}>
        {/* Simulated receipt paper */}
        <div style={R.paper}>
          <div style={R.shopName}>{shopName}</div>
          {storeId && <div style={R.subTitle}>ID: {storeId}</div>}
          <div style={R.divider}>- - - - - - - - - - - - - - -</div>
          <div style={R.infoRow}>
            <span>{dateStr}</span><span>{timeStr}</span>
          </div>
          <div style={R.infoRow}>
            <span>{tableId === 0 ? t('takeaway') : `${t('tableNo')} ${tableId}`}</span>
            <span>#{order.id.substring(0, 8).toUpperCase()}</span>
          </div>
          <div style={R.divider}>- - - - - - - - - - - - - - -</div>

          {order.items.map((item, i) => (
            <div key={i}>
              <div style={R.itemRow}>
                <span style={{ flex: 1 }}>{item.qty}x {item.name}</span>
                <span>RM {(item.price * item.qty).toFixed(2)}</span>
              </div>
              {item.note && <div style={R.itemNote}>  * {item.note}</div>}
            </div>
          ))}

          <div style={R.divider}>- - - - - - - - - - - - - - -</div>
          <div style={R.totalRow}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>TOTAL</span>
            <span style={{ fontWeight: 800, fontSize: 16 }}>RM {subtotal.toFixed(2)}</span>
          </div>
          <div style={R.itemRow}>
            <span>{t('received')}</span>
            <span>RM {payment.received.toFixed(2)}</span>
          </div>
          <div style={R.itemRow}>
            <span>{t('change')}</span>
            <span>RM {Math.max(0, payment.change).toFixed(2)}</span>
          </div>
          <div style={R.divider}>- - - - - - - - - - - - - - -</div>
          <div style={R.thankYou}>{t('thankYou')}</div>
        </div>

        <button style={R.closeBtn} onClick={onClose}>
          ✓ {t('confirm')} — {t('back')}
        </button>
      </div>
    </div>
  )
}

const R = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, animation: 'fadeIn 0.15s',
  },
  box: {
    width: '90%', maxWidth: 360, animation: 'slideUp 0.3s',
  },
  paper: {
    background: '#FFFFF5', color: '#111111', borderRadius: 4,
    padding: '20px 16px', fontFamily: "'Courier New', Courier, monospace",
    fontSize: 13, lineHeight: 1.6,
    boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
  },
  shopName: { textAlign: 'center', fontSize: 18, fontWeight: 800, marginBottom: 4 },
  subTitle: { textAlign: 'center', fontSize: 12, color: '#555', marginBottom: 2 },
  divider: { textAlign: 'center', color: '#999', margin: '6px 0', letterSpacing: 2 },
  infoRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' },
  itemRow: { display: 'flex', justifyContent: 'space-between', padding: '2px 0' },
  itemNote: { color: '#888', fontSize: 11, paddingLeft: 10 },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', padding: '4px 0',
    borderTop: '1px solid #CCC', borderBottom: '1px solid #CCC',
    margin: '4px 0',
  },
  thankYou: { textAlign: 'center', fontSize: 14, fontWeight: 700, marginTop: 4 },
  closeBtn: {
    width: '100%', padding: 14, marginTop: 12,
    background: 'var(--grad-primary)', color: '#FFFFFF',
    borderRadius: 12, fontSize: 15, fontWeight: 700,
    boxShadow: '0 4px 12px rgba(255,107,44,0.4)',
  },
}

// ═══ Checkout Modal ═══
function CheckoutModal({ total, t, onConfirm, onClose }) {
  const [received, setReceived] = useState('0')
  const num = parseFloat(received) || 0
  const change = num - total

  const handleKey = (key) => {
    if (key === '⌫') setReceived(received.slice(0, -1) || '0')
    else if (key === '.') { if (!received.includes('.')) setReceived(received + '.') }
    else {
      if (received === '0') setReceived(key)
      else { if (received.includes('.') && received.split('.')[1].length >= 2) return; setReceived(received + key) }
    }
  }

  return (
    <div onClick={onClose} style={C.overlay}>
      <div onClick={e => e.stopPropagation()} style={C.box}>
        <h3 style={{ color: 'var(--primary)', fontSize: 18, margin: '0 0 14px', textAlign: 'center', fontWeight: 700 }}>
          💵 {t('cash')}
        </h3>
        <div style={C.totalBox}>
          <span style={{ color: 'var(--text-light)' }}>{t('total')}</span>
          <span style={{ color: 'var(--primary)', fontSize: 28, fontWeight: 800 }}>RM {total.toFixed(2)}</span>
        </div>
        <div style={C.quicks}>
          {[10, 20, 50, 100].map(a => (
            <button key={a} onClick={() => setReceived(a.toFixed(2))} style={C.quickBtn}>RM {a}</button>
          ))}
        </div>
        <div style={C.receivedBox}>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{t('received')}</span>
          <span style={{ color: 'var(--text)', fontSize: 24, fontWeight: 700 }}>RM {parseFloat(received || 0).toFixed(2)}</span>
        </div>
        <div style={{
          ...C.changeBox,
          background: change < 0 ? 'var(--danger-light)' : 'var(--success-light)',
          borderColor: change < 0 ? 'var(--danger)' : 'var(--success)',
        }}>
          <span style={{ color: change < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{t('change')}</span>
          <span style={{ color: change < 0 ? 'var(--danger)' : 'var(--success)', fontSize: 24, fontWeight: 700 }}>
            RM {change >= 0 ? change.toFixed(2) : '---'}
          </span>
        </div>
        <div style={C.numpad}>
          {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(key => (
            <button key={key} onClick={() => handleKey(key)} style={{
              ...C.numKey, ...(key === '⌫' ? { background: 'var(--danger-light)', color: 'var(--danger)' } : {}),
            }}>{key}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={C.cancelBtn}>{t('cancel')}</button>
          <button onClick={() => change >= 0 && onConfirm({ received: num, change })}
            disabled={change < 0} style={{ ...C.confirmBtn, opacity: change < 0 ? 0.3 : 1 }}>
            ✓ {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

const C = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.15s' },
  box: { width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '95vh', overflow: 'auto', animation: 'slideUp 0.25s', borderTop: '3px solid var(--primary)' },
  totalBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', marginBottom: 12, background: 'var(--primary-light)', borderRadius: 12, border: '1px solid var(--border)' },
  quicks: { display: 'flex', gap: 8, marginBottom: 10 },
  quickBtn: { flex: 1, padding: '12px 0', borderRadius: 10, background: 'var(--bg-lighter)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, fontWeight: 700 },
  receivedBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', marginBottom: 8, background: 'var(--primary-light)', borderRadius: 12, border: '1px solid var(--border)' },
  changeBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', marginBottom: 12, borderRadius: 12, border: '1px solid' },
  numpad: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  numKey: { padding: 18, background: 'var(--bg-lighter)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 22, fontWeight: 700 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, background: 'var(--bg-lighter)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14 },
  confirmBtn: { flex: 2, padding: 14, borderRadius: 12, background: 'var(--grad-primary)', color: '#FFFFFF', fontSize: 16, fontWeight: 800 },
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' },
  backBtn: { background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 10, fontSize: 14 },
  addBtn: { background: 'var(--grad-primary)', color: '#FFFFFF', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700 },
  itemsScroll: { flex: 1, overflow: 'auto', padding: 14 },
  itemRow: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg-card)', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid var(--border)' },
  itemIndex: { width: 26, height: 26, borderRadius: 13, background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  noteDisplay: { marginTop: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--warning-light)', color: 'var(--gold-dark)', fontSize: 11, fontWeight: 600, display: 'inline-block' },
  qtyGroup: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, background: 'var(--bg-lighter)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 18, fontWeight: 700 },
  itemActions: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 },
  miniBtn: { background: 'var(--bg-lighter)', border: '1px solid var(--border)', width: 30, height: 30, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  deleteBtnSmall: { color: 'var(--danger)', background: 'var(--danger-light)', width: 30, height: 30, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  footer: { background: 'var(--bg-card)', padding: 14, borderTop: '1px solid var(--border)' },
  cancelBtn: { background: 'var(--danger-light)', color: 'var(--danger)', padding: '12px 14px', borderRadius: 12, fontSize: 13, border: '1px solid var(--danger)' },
  kitchenBtn: { background: 'var(--bg-lighter)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 12, fontSize: 20 },
  checkoutBtn: { flex: 1, background: 'var(--grad-primary)', color: '#FFFFFF', padding: 14, borderRadius: 12, fontSize: 16, fontWeight: 800 },
  waiterHint: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, background: 'var(--bg-lighter)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.15s' },
  modalBox: { width: '100%', maxWidth: 520, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: 20, animation: 'slideUp 0.25s', borderTop: '3px solid var(--warning)' },
  quickNoteBtn: { padding: '6px 12px', borderRadius: 16, background: 'var(--warning-light)', border: '1px solid var(--warning)', color: 'var(--text)', fontSize: 12, fontWeight: 600 },
  noteInput: { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box', resize: 'none' },
  modalCancelBtn: { flex: 1, padding: 12, background: 'var(--bg-lighter)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, fontSize: 14 },
  modalSaveBtn: { flex: 1, padding: 12, background: 'var(--grad-primary)', color: '#FFFFFF', borderRadius: 10, fontSize: 14, fontWeight: 700 },
}
