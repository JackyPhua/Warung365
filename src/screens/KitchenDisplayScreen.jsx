// src/screens/KitchenDisplayScreen.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { DEPARTMENTS, getLocalizedName } from '../data/menuData'
import SoundService from '../services/SoundService'
import DispatchService from '../services/DispatchService'

export default function KitchenDisplayScreen({ department: initialDept, onNavigate }) {
  const { state, dispatch, t } = useApp()
  const [selectedDept, setSelectedDept] = useState(initialDept || 'all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [now, setNow] = useState(Date.now())
  const prevPendingRef = useRef(0)
  const lang = state.language

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000)
    return () => clearInterval(timer)
  }, [])

  const orderCards = useMemo(() => {
    const cards = []
    Object.values(state.orders).forEach(order => {
      const items = order.items.filter(item => {
        if (item.kdsStatus === 'served') return false
        if (selectedDept === 'all') return true
        return (item.department || 'food') === selectedDept
      })
      if (items.length === 0) return

      const pendingItems = items.filter(i => i.kdsStatus !== 'ready')
      const readyItems = items.filter(i => i.kdsStatus === 'ready')
      const allReady = pendingItems.length === 0

      cards.push({
        orderId: order.id,
        tableId: order.tableId,
        type: order.type,
        createdAt: order.createdAt,
        items,
        pendingItems,
        readyItems,
        allReady,
      })
    })

    cards.sort((a, b) => {
      if (a.allReady !== b.allReady) return a.allReady ? 1 : -1
      return new Date(a.createdAt) - new Date(b.createdAt)
    })

    return cards
  }, [state.orders, selectedDept])

  const pendingCards = orderCards.filter(c => !c.allReady)
  const readyCards = orderCards.filter(c => c.allReady)

  // Sound alert when new pending items appear
  useEffect(() => {
    const currentPending = pendingCards.reduce((s, c) => s + c.pendingItems.length, 0)
    if (currentPending > prevPendingRef.current && prevPendingRef.current !== 0) {
      SoundService.orderSound()
    }
    prevPendingRef.current = currentPending
  }, [pendingCards])

  const getElapsed = (createdAt) => {
    const diff = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000))
    const min = Math.floor(diff / 60)
    const sec = diff % 60
    return `${min}:${String(sec).padStart(2, '0')}`
  }

  const getTimerColor = (createdAt) => {
    const min = (now - new Date(createdAt).getTime()) / 60000
    if (min < 5) return '#16A34A'
    if (min < 10) return '#F59E0B'
    return '#DC2626'
  }

  const markItemReady = (orderId, itemId) => {
    dispatch({ type: 'UPDATE_ITEMS_KDS_STATUS', payload: { orderId, itemIds: [itemId], status: 'ready' } })
    SoundService.tapSound()
  }

  const markAllReady = (orderId, items) => {
    const itemIds = items.filter(i => i.kdsStatus !== 'ready').map(i => i.id)
    if (itemIds.length === 0) return
    dispatch({ type: 'UPDATE_ITEMS_KDS_STATUS', payload: { orderId, itemIds, status: 'ready' } })
    SoundService.paymentSound()
    // Push an immediate "ready" notification to all connected workers
    const order = state.orders[orderId]
    if (order) {
      const itemSummary = items.map(i => i.name.split(' [')[0]).join(', ')
      DispatchService.notifyReady({ orderId, tableId: order.tableId, itemSummary }).catch(() => {})
    }
  }

  const undoItem = (orderId, itemId) => {
    dispatch({ type: 'UPDATE_ITEMS_KDS_STATUS', payload: { orderId, itemIds: [itemId], status: 'pending' } })
  }

  const deptLabel = selectedDept === 'all'
    ? t('allDepts')
    : getLocalizedName(DEPARTMENTS.find(d => d.id === selectedDept)?.label, lang) || selectedDept

  const totalPending = pendingCards.reduce((s, c) => s + c.pendingItems.length, 0)

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
        <div style={S.headerTitle}>
          <span style={{ fontSize: 20 }}>📺</span>
          <span>{t('kds')} — {deptLabel}</span>
        </div>
        <div style={S.headerStats}>
          <span style={S.pendingBadge}>{totalPending} {t('pendingItems')}</span>
          <span style={S.readyBadge}>{readyCards.length} {t('readyItems')}</span>
        </div>
      </div>

      {/* Department tabs */}
      <div style={S.tabBar}>
        <DeptTab
          active={selectedDept === 'all'}
          label={t('allDepts')}
          icon="📋"
          color="#FF6B2C"
          onClick={() => setSelectedDept('all')}
        />
        {DEPARTMENTS.map(d => (
          <DeptTab
            key={d.id}
            active={selectedDept === d.id}
            label={getLocalizedName(d.label, lang)}
            icon={d.icon}
            color={d.color}
            onClick={() => setSelectedDept(d.id)}
          />
        ))}
      </div>

      {/* Order cards grid */}
      <div style={S.scrollArea}>
        {pendingCards.length === 0 && readyCards.length === 0 && (
          <div style={S.emptyState}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🍽️</div>
            <div style={{ fontSize: 18, color: 'var(--text-light)' }}>{t('noActiveOrders')}</div>
          </div>
        )}

        {pendingCards.length > 0 && (
          <div style={S.cardGrid}>
            {pendingCards.map(card => (
              <OrderCard
                key={card.orderId}
                card={card}
                now={now}
                lang={lang}
                t={t}
                getElapsed={getElapsed}
                getTimerColor={getTimerColor}
                onMarkItem={markItemReady}
                onMarkAll={markAllReady}
                onUndoItem={undoItem}
              />
            ))}
          </div>
        )}

        {readyCards.length > 0 && (
          <>
            <button style={S.completedToggle} onClick={() => setShowCompleted(!showCompleted)}>
              <span>✅ {t('readyItems')} ({readyCards.length})</span>
              <span>{showCompleted ? '▼' : '▶'}</span>
            </button>
            {showCompleted && (
              <div style={S.cardGrid}>
                {readyCards.map(card => (
                  <OrderCard
                    key={card.orderId}
                    card={card}
                    now={now}
                    lang={lang}
                    t={t}
                    getElapsed={getElapsed}
                    getTimerColor={getTimerColor}
                    onMarkItem={markItemReady}
                    onMarkAll={markAllReady}
                    onUndoItem={undoItem}
                    isCompleted
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function DeptTab({ active, label, icon, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
      background: active ? color : 'var(--bg-card)',
      color: active ? '#FFFFFF' : 'var(--text)',
      border: active ? `2px solid ${color}` : '2px solid var(--border)',
      boxShadow: active ? `0 4px 12px ${color}44` : 'var(--shadow-sm)',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  )
}

function OrderCard({ card, now, lang, t, getElapsed, getTimerColor, onMarkItem, onMarkAll, onUndoItem, isCompleted }) {
  const timerColor = getTimerColor(card.createdAt)
  const elapsed = getElapsed(card.createdAt)
  const isNew = (now - new Date(card.createdAt).getTime()) < 30000

  return (
    <div style={{
      ...S.card,
      borderColor: isCompleted ? '#16A34A' : timerColor,
      borderWidth: isCompleted ? 2 : 3,
      animation: isNew && !isCompleted ? 'fadeIn 0.3s' : undefined,
      opacity: isCompleted ? 0.75 : 1,
    }}>
      {/* Card header */}
      <div style={{
        ...S.cardHeader,
        background: isCompleted
          ? 'linear-gradient(135deg, #DCFCE7, #D1FAE5)'
          : `linear-gradient(135deg, ${timerColor}15, ${timerColor}08)`,
      }}>
        <div style={S.cardHeaderLeft}>
          <span style={{ fontSize: 20 }}>
            {card.tableId === 0 ? '📦' : '🪑'}
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              {card.tableId === 0 ? t('takeaway') : `${t('tableNo')} ${card.tableId}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              #{card.orderId.substring(0, 6).toUpperCase()}
            </div>
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 8, fontWeight: 800, fontSize: 14,
          background: isCompleted ? '#16A34A' : timerColor,
          color: '#FFFFFF',
        }}>
          {isCompleted ? '✓' : elapsed}
        </div>
      </div>

      {/* Items */}
      <div style={S.cardItems}>
        {card.items.map(item => {
          const isReady = item.kdsStatus === 'ready'
          return (
            <button
              key={item.id}
              onClick={() => isReady ? onUndoItem(card.orderId, item.id) : onMarkItem(card.orderId, item.id)}
              style={{
                ...S.itemRow,
                background: isReady ? '#DCFCE7' : 'var(--bg-lighter)',
                borderColor: isReady ? '#16A34A' : 'var(--border)',
                textDecoration: isReady ? 'line-through' : 'none',
                opacity: isReady ? 0.7 : 1,
              }}
            >
              <div style={S.itemCheck}>
                {isReady ? '✅' : '⬜'}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {item.qty}x {item.name}
                </div>
                {item.note && (
                  <div style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>📝 {item.note}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Complete all button */}
      {!isCompleted && card.pendingItems.length > 0 && (
        <button
          style={S.completeAllBtn}
          onClick={() => onMarkAll(card.orderId, card.items)}
        >
          ✓ {t('markAllReady')}
        </button>
      )}
      {isCompleted && (
        <div style={S.completedLabel}>
          ✅ {t('readyToServe')}
        </div>
      )}
    </div>
  )
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap', gap: 8,
  },
  backBtn: {
    background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 14,
  },
  headerTitle: {
    display: 'flex', alignItems: 'center', gap: 8,
    color: 'var(--primary)', fontSize: 16, fontWeight: 800,
  },
  headerStats: { display: 'flex', gap: 8, alignItems: 'center' },
  pendingBadge: {
    padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700,
    background: '#FEF3C7', color: '#D97706', border: '1px solid #F59E0B',
  },
  readyBadge: {
    padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 700,
    background: '#DCFCE7', color: '#16A34A', border: '1px solid #16A34A',
  },
  tabBar: {
    display: 'flex', gap: 8, padding: '10px 16px',
    background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
    overflowX: 'auto',
  },
  scrollArea: { flex: 1, overflow: 'auto', padding: 16 },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '60%', opacity: 0.6,
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 14, marginBottom: 16,
  },
  card: {
    background: 'var(--bg-card)', borderRadius: 16,
    border: '3px solid', overflow: 'hidden',
    boxShadow: 'var(--shadow)',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px',
  },
  cardHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  cardItems: { padding: '8px 12px' },
  itemRow: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 12px', borderRadius: 10, marginBottom: 6,
    border: '1px solid', width: '100%', textAlign: 'left',
    transition: 'all 0.15s',
  },
  itemCheck: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  completeAllBtn: {
    width: '100%', padding: '14px 16px',
    background: 'linear-gradient(135deg, #16A34A, #15803D)',
    color: '#FFFFFF', fontSize: 16, fontWeight: 800,
    borderTop: '1px solid var(--border)',
    borderRadius: '0 0 13px 13px',
  },
  completedLabel: {
    textAlign: 'center', padding: '10px 16px',
    color: '#16A34A', fontSize: 14, fontWeight: 700,
    background: '#DCFCE7', borderTop: '1px solid #BBF7D0',
  },
  completedToggle: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', padding: '12px 16px', marginBottom: 12,
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 12, color: '#16A34A', fontSize: 14, fontWeight: 700,
  },
}
