// src/screens/MenuScreen.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../context/AppContext'
import { COOKING_METHODS, getLocalizedName } from '../data/menuData'
import SoundService from '../services/SoundService'

export default function MenuScreen({ tableId, orderId: existingOrderId, orderType = 'dine_in', onNavigate }) {
  const { state, dispatch, t, createOrder, getOrderTotal } = useApp()

  const isNewOrder = !existingOrderId
  const [activeOrderId, setActiveOrderId] = useState(existingOrderId || null)
  const [selectedCatId, setSelectedCatId] = useState(state.menu[0]?.id)
  const [pendingItem, setPendingItem] = useState(null)
  const [group1Choice, setGroup1Choice] = useState(null)
  const [group2Choice, setGroup2Choice] = useState(null)
  const [tempItem, setTempItem] = useState(null)

  const allowUnmountCancelRef = useRef(true)
  const draftMetaRef = useRef({
    orderId: null, tableId, isNewOrder, isEmpty: true,
  })

  // Create order after first render (not during render)
  useEffect(() => {
    if (!activeOrderId) {
      const newId = createOrder(tableId, orderType)
      setActiveOrderId(newId)
    }
  }, [])

  // System back / route change without our "Back" button: drop empty draft orders
  useEffect(() => () => {
    if (!allowUnmountCancelRef.current) return
    const { orderId, tableId: tid, isNewOrder: isNew, isEmpty } = draftMetaRef.current
    if (!isNew || !orderId || !isEmpty) return
    dispatch({ type: 'CANCEL_ORDER', payload: { orderId, tableId: tid } })
  }, [dispatch])

  const order = activeOrderId ? state.orders[activeOrderId] : null
  draftMetaRef.current = {
    orderId: activeOrderId,
    tableId,
    isNewOrder,
    isEmpty: !(order?.items?.length),
  }

  // No items added for 10s → free the table (new menu session only)
  const itemCount = order?.items?.length ?? 0
  useEffect(() => {
    if (!isNewOrder || !activeOrderId || itemCount > 0) return
    const timer = setTimeout(() => {
      allowUnmountCancelRef.current = false
      dispatch({ type: 'CANCEL_ORDER', payload: { orderId: activeOrderId, tableId } })
      onNavigate('tables')
    }, 10000)
    return () => clearTimeout(timer)
  }, [isNewOrder, activeOrderId, itemCount, tableId, dispatch, onNavigate])

  // Back button: auto cancel empty new orders
  const handleBack = () => {
    allowUnmountCancelRef.current = false
    if (activeOrderId) {
      const ord = state.orders[activeOrderId]
      if (isNewOrder && ord && ord.items.length === 0) {
        dispatch({ type: 'CANCEL_ORDER', payload: { orderId: activeOrderId, tableId } })
      }
    }
    onNavigate('tables')
  }
  const total = activeOrderId ? getOrderTotal(activeOrderId) : 0
  const lang = state.language
  const selectedCat = state.menu.find(c => c.id === selectedCatId) || state.menu[0]

  const addItem = (d) => {
    if (!activeOrderId) return
    dispatch({ type: 'ADD_ITEM_TO_ORDER', payload: { orderId: activeOrderId, item: { id: uuidv4(), ...d } } })
    SoundService.orderSound()
  }

  const handleItemClick = (item) => {
    SoundService.tapSound()
    const dept = selectedCat?.department || 'food'
    if (item.type === 'simple') setTempItem({ name: getLocalizedName(item.name, lang), price: item.price, department: dept })
    else if (item.type === 'portion') setPendingItem({ ...item, _department: dept })
    else { setPendingItem({ ...item, _department: dept }); setGroup1Choice(null); setGroup2Choice(null) }
  }

  const onPortionSelect = (p) => {
    setTempItem({ name: `${getLocalizedName(pendingItem.name, lang)} (${getLocalizedName(p.name, lang)})`, price: p.price, department: pendingItem._department || 'food' })
    setPendingItem(null)
  }

  const onMultiComplete = () => {
    if (!group1Choice || !group2Choice) return
    const finalPrice = group1Choice.price != null ? group1Choice.price : pendingItem.price
    setTempItem({
      name: `${getLocalizedName(pendingItem.name, lang)} (${getLocalizedName(group1Choice.name, lang)}, ${getLocalizedName(group2Choice.name, lang)})`,
      price: finalPrice,
      department: pendingItem._department || 'food',
    })
    setPendingItem(null); setGroup1Choice(null); setGroup2Choice(null)
  }

  const onCookingMethodComplete = (method) => {
    addItem({
      name: `${tempItem.name} [${t(method.key)}]`,
      price: tempItem.price + (state.cookingMethodPrices[method.id] || 0),
      qty: 1, method: method.id,
      department: tempItem.department || 'food',
      kdsStatus: 'pending',
    })
    setTempItem(null)
  }

  const getPrice = (item) => item.type === 'portion' ? (item.portions?.[0]?.price || 0) : (item.price || 0)

  /** Takeaway order sheet: no dine-in row; packing fee Row only when RM>0 else one plain 「打包」 + extras */
  const takeawayOrder = orderType === 'takeaway'
  const takeawayPackFee = state.cookingMethodPrices?.takeaway ?? 0
  const cookingMethodRows = useMemo(() => {
    let list = takeawayOrder ? COOKING_METHODS.filter((m) => m.id !== 'dine_in') : [...COOKING_METHODS]
    if (takeawayOrder && takeawayPackFee <= 0) {
      list = list.filter((m) => m.id !== 'takeaway')
    }
    return list
  }, [takeawayOrder, takeawayPackFee])

  // Loading state (order being created)
  if (!activeOrderId) return (
    <div style={S.container}>
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>...</div>
    </div>
  )

  // Empty menu
  if (!state.menu?.length) return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={handleBack}>← {t('back')}</button>
      </div>
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>{t('noItems')}</div>
    </div>
  )

  return (
    <div style={S.container}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={handleBack}>← {t('back')}</button>
        <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 700 }}>
          {tableId === 0 ? `📦 ${t('takeaway')}` : `🪑 ${t('tableNo')} ${tableId}`}
        </div>
        <button style={S.cartBtn} onClick={() => {
          allowUnmountCancelRef.current = false
          onNavigate('order', { orderId: activeOrderId, tableId })
        }}>
          🧾 {order?.items?.length || 0} · RM {total.toFixed(2)}
        </button>
      </div>

      <div style={S.main}>
        {/* Sidebar categories */}
        <div style={S.sidebar}>
          {state.menu.map(cat => {
            const active = selectedCatId === cat.id
            return (
              <button key={cat.id} onClick={() => setSelectedCatId(cat.id)} style={{
                ...S.catBtn,
                background: active ? cat.color : 'transparent',
                color: active ? '#FFFFFF' : 'var(--text-light)',
                borderLeft: active ? `4px solid ${cat.color}` : '4px solid transparent',
              }}>
                <div style={{ fontSize: 24 }}>{cat.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{getLocalizedName(cat.name, lang)}</div>
              </button>
            )
          })}
        </div>

        {/* Items */}
        <div style={S.itemsArea}>
          <div style={{ color: selectedCat?.color, fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{selectedCat?.icon}</span>
            {getLocalizedName(selectedCat?.name, lang)}
            <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 400 }}>· {selectedCat?.items.length}</span>
          </div>
          <div style={S.itemGrid}>
            {selectedCat?.items.map(item => (
              <button key={item.id} style={S.itemBtn} onClick={() => handleItemClick(item)}>
                <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                  {getLocalizedName(item.name, lang)}
                </div>
                <div style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 700, marginTop: 6 }}>
                  RM {getPrice(item).toFixed(2)}{item.type !== 'simple' ? '+' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Portion modal */}
      {pendingItem?.type === 'portion' && (
        <Modal onClose={() => setPendingItem(null)}>
          <h3 style={S.modalTitle}>{getLocalizedName(pendingItem.name, lang)}</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {pendingItem.portions.map(p => (
              <button key={p.id} onClick={() => onPortionSelect(p)} style={{
                flex: '1 1 45%', padding: 20, borderRadius: 14,
                background: 'var(--bg-lighter)', border: '2px solid var(--primary)',
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{getLocalizedName(p.name, lang)}</div>
                <div style={{ fontSize: 22, color: 'var(--primary)', marginTop: 8, fontWeight: 800 }}>RM {p.price.toFixed(2)}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Multi modal */}
      {pendingItem?.type === 'multi' && (
        <Modal onClose={() => setPendingItem(null)}>
          <h3 style={S.modalTitle}>{getLocalizedName(pendingItem.name, lang)}</h3>

          <div style={S.modalSection}>{getLocalizedName(pendingItem.group1Label, lang)}</div>
          <div style={S.chipRow}>
            {pendingItem.group1.map(g => {
              const active = group1Choice?.id === g.id
              return (
                <button key={g.id} onClick={() => setGroup1Choice(g)} style={{
                  ...S.chip,
                  background: active ? 'var(--primary)' : 'var(--bg-lighter)',
                  color: active ? '#FFFFFF' : 'var(--text)',
                  borderColor: active ? 'var(--primary)' : 'var(--border)',
                }}>
                  {getLocalizedName(g.name, lang)}
                  {g.price != null && (
                    <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.85 }}>RM{g.price.toFixed(2)}</span>
                  )}
                </button>
              )
            })}
          </div>

          <div style={S.modalSection}>{getLocalizedName(pendingItem.group2Label, lang)}</div>
          <div style={S.chipRow}>
            {pendingItem.group2.map(g => {
              const active = group2Choice?.id === g.id
              return (
                <button key={g.id} onClick={() => setGroup2Choice(g)} style={{
                  ...S.chip,
                  background: active ? 'var(--gold)' : 'var(--bg-lighter)',
                  color: active ? 'var(--text)' : 'var(--text)',
                  borderColor: active ? 'var(--gold)' : 'var(--border)',
                }}>
                  {getLocalizedName(g.name, lang)}
                </button>
              )
            })}
          </div>

          <button
            onClick={onMultiComplete}
            disabled={!group1Choice || !group2Choice}
            style={{ ...S.primaryBtn, opacity: (!group1Choice || !group2Choice) ? 0.4 : 1 }}
          >
            {t('confirm')} →
          </button>
        </Modal>
      )}

      {/* Cooking method */}
      {tempItem && (
        <Modal onClose={() => setTempItem(null)}>
          <h3 style={S.modalTitle}>🍽️ {tempItem.name}</h3>
          <div style={S.modalSection}>
            {takeawayOrder ? t('takeawayExtrasPrompt') : `${t('dineIn')} / ${t('takeaway')}`}
          </div>
          {takeawayOrder && takeawayPackFee <= 0 && (
            <button
              key="takeaway-plain"
              type="button"
              onClick={() => onCookingMethodComplete(COOKING_METHODS.find((m) => m.id === 'takeaway'))}
              style={S.methodBtn}
            >
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('takeaway')}</span>
            </button>
          )}
          {cookingMethodRows.map((method) => (
            <button key={method.id} type="button" onClick={() => onCookingMethodComplete(method)} style={S.methodBtn}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{t(method.key)}</span>
              {state.cookingMethodPrices[method.id] > 0 && (
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  +RM {state.cookingMethodPrices[method.id].toFixed(2)}
                </span>
              )}
            </button>
          ))}
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      zIndex: 100, animation: 'fadeIn 0.15s',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520, background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '85vh',
        overflow: 'auto', animation: 'slideUp 0.25s',
        borderTop: '3px solid var(--primary)',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
      }}>
        {children}
      </div>
    </div>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  backBtn: {
    background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 14,
  },
  cartBtn: {
    background: 'var(--grad-primary)', color: '#FFFFFF',
    padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 800,
    boxShadow: 'var(--shadow-purple)',
  },
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: 90, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
    padding: '8px 4px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
  },
  catBtn: {
    padding: '12px 4px', borderRadius: 10, display: 'flex', flexDirection: 'column',
    alignItems: 'center', transition: 'all 0.15s',
  },
  itemsArea: { flex: 1, overflow: 'auto', padding: 16 },
  itemGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10,
  },
  itemBtn: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column',
    alignItems: 'center', minHeight: 90, boxShadow: 'var(--shadow-sm)',
  },
  modalTitle: { color: 'var(--primary)', fontSize: 18, margin: '0 0 16px', textAlign: 'center', fontWeight: 700 },
  modalSection: { color: 'var(--text-light)', fontSize: 12, fontWeight: 700, margin: '14px 0 8px', textTransform: 'uppercase' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '10px 16px', borderRadius: 22, border: '2px solid',
    fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
  },
  methodBtn: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 18px', borderRadius: 12, marginBottom: 8,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)', width: '100%',
  },
  primaryBtn: {
    width: '100%', padding: 14, marginTop: 16,
    background: 'var(--grad-primary)', color: '#FFFFFF',
    borderRadius: 12, fontSize: 16, fontWeight: 700,
  },
}
