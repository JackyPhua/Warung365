// src/screens/TableScreen.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useApp, TABLE_STATUS } from '../context/AppContext'
import SoundService from '../services/SoundService'

const TABLE_STYLES = {
  [TABLE_STATUS.EMPTY]: { bg: 'var(--bg-card)', border: 'var(--border)', numColor: 'var(--text)', labelColor: 'var(--text-muted)' },
  [TABLE_STATUS.OCCUPIED]: { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', border: '#EF4444', numColor: '#FFFFFF', labelColor: '#FFD4D4' },
  [TABLE_STATUS.PAID]: { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', border: '#22C55E', numColor: '#FFFFFF', labelColor: '#D1FAE5' },
  [TABLE_STATUS.TAKEAWAY]: { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '#F59E0B', numColor: '#FFFFFF', labelColor: '#FEF3C7' },
}

export default function TableScreen({ onNavigate }) {
  const { state, dispatch, t, isLicenseValid, getLicenseDaysLeft, getTableOrders, getTableTotal } = useApp()
  const [showOrderPicker, setShowOrderPicker] = useState(null)
  const prevReadyCountRef = useRef(0)
  const [winW, setWinW] = useState(window.innerWidth)
  useEffect(() => {
    const h = () => setWinW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const compact = winW < 600

  const handleTableClick = (table) => {
    if (!isLicenseValid()) { alert(t('license') + ' ' + t('expired')); return }
    switch (table.status) {
      case TABLE_STATUS.EMPTY:
        onNavigate('menu', { tableId: table.id, orderType: 'dine_in' })
        break
      case TABLE_STATUS.OCCUPIED:
      case TABLE_STATUS.TAKEAWAY:
        if (table.orderIds.length === 1) {
          onNavigate('order', { orderId: table.orderIds[0], tableId: table.id })
        } else {
          setShowOrderPicker(table.id)
        }
        break
      case TABLE_STATUS.PAID:
        break
    }
  }

  const handleTableLongPress = (table) => {
    if (table.status === TABLE_STATUS.EMPTY) {
      if (confirm(`${t('tableNo')} ${table.id} - ${t('takeaway')}?`))
        onNavigate('menu', { tableId: table.id, orderType: 'takeaway' })
    } else if (table.status === TABLE_STATUS.OCCUPIED || table.status === TABLE_STATUS.TAKEAWAY) {
      setShowOrderPicker(table.id)
    }
  }

  const getLabel = (table) => {
    switch (table.status) {
      case TABLE_STATUS.EMPTY: return t('emptyTable')
      case TABLE_STATUS.OCCUPIED:
      case TABLE_STATUS.TAKEAWAY: {
        const total = getTableTotal(table.id)
        return `RM ${total.toFixed(2)}`
      }
      case TABLE_STATUS.PAID: return '✓ ' + t('paid')
    }
  }

  const daysLeft = getLicenseDaysLeft()
  const licenseText = state.licenseType === 'trial'
    ? `${t('trial')} · ${daysLeft} ${t('trialDays')}`
    : `${t('monthly')} · ${daysLeft}d`

  const occupiedCount = state.tables.filter(t => t.status === TABLE_STATUS.OCCUPIED).length
  const takeawayCount = state.tables.filter(t => t.status === TABLE_STATUS.TAKEAWAY).length
  const todayOrders = state.completedOrders.filter(o =>
    !o.refunded && new Date(o.completedAt).toDateString() === new Date().toDateString()
  )
  const todayRevenue = todayOrders.reduce((s, o) => s + ((o.payment?.received || 0) - (o.payment?.change || 0)), 0)

  // Orders that can be marked "delivered" by waiter: nothing still cooking; something not yet served
  const readyToServeOrders = useMemo(() => {
    const list = []
    Object.values(state.orders).forEach(order => {
      if (!order.items.length) return
      const hasPending = order.items.some(i => i.kdsStatus === 'pending')
      if (hasPending) return
      const needsConfirm = order.items.some(i => i.kdsStatus !== 'served')
      if (!needsConfirm) return
      list.push({
        orderId: order.id,
        tableId: order.tableId,
        type: order.type,
        createdAt: order.createdAt,
        items: order.items,
        itemSummary: order.items.map(i => i.name.split(' [')[0]).join(', '),
      })
    })
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    return list
  }, [state.orders])

  const dineInReadyGroups = useMemo(() => {
    const map = new Map()
    readyToServeOrders.forEach(o => {
      if (o.tableId === 0) return
      if (!map.has(o.tableId)) map.set(o.tableId, [])
      map.get(o.tableId).push(o)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
  }, [readyToServeOrders])

  const takeawayReadyOrders = useMemo(
    () => readyToServeOrders.filter(o => o.tableId === 0),
    [readyToServeOrders],
  )

  const readyTableIds = useMemo(() => {
    const ids = new Set()
    readyToServeOrders.forEach(o => { if (o.tableId > 0) ids.add(o.tableId) })
    return ids
  }, [readyToServeOrders])

  // Active takeaway orders (tableId===0, not yet checked out)
  const activeTakeawayOrders = useMemo(() =>
    Object.values(state.orders).filter(o => o.tableId === 0 && o.items.length > 0),
    [state.orders]
  )

  // Tables where ALL active orders have ALL items served (delivered, awaiting payment)
  const servedTableIds = useMemo(() => {
    const ids = new Set()
    state.tables.forEach(table => {
      if (table.orderIds.length === 0) return
      const orders = table.orderIds.map(id => state.orders[id]).filter(Boolean)
      if (orders.length === 0) return
      const allServed = orders.every(o =>
        o.items.length > 0 && o.items.every(i => i.kdsStatus === 'served')
      )
      if (allServed) ids.add(table.id)
    })
    return ids
  }, [state.tables, state.orders])

  // Sound alert when new ready-to-serve orders appear
  useEffect(() => {
    const count = readyToServeOrders.length
    if (count > prevReadyCountRef.current && prevReadyCountRef.current !== -1) {
      SoundService.notifySound()
    }
    prevReadyCountRef.current = count
  }, [readyToServeOrders])

  const handleConfirmDelivered = (orderIds, dismissTableIds) => {
    if (!orderIds?.length) return
    dispatch({
      type: 'CONFIRM_MEAL_DELIVERED',
      payload: { orderIds, dismissNotificationTableIds: dismissTableIds },
    })
    SoundService.tapSound()
  }

  const pickerTable = showOrderPicker ? state.tables.find(t => t.id === showOrderPicker) : null
  const pickerOrders = showOrderPicker ? getTableOrders(showOrderPicker) : []

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ ...styles.header, flexWrap: 'wrap', padding: compact ? '10px 12px' : '14px 20px' }}>
        <div style={styles.brand}>
          <div style={{ ...styles.brandIcon, width: compact ? 36 : 44, height: compact ? 36 : 44, fontSize: compact ? 20 : 24 }}>🍱</div>
          <div>
            <div style={{ ...styles.shopName, fontSize: compact ? 18 : 22 }}>
              <span style={{ color: '#FFFFFF' }}>Warung</span>
              <span style={{ color: '#FFF3C7', fontWeight: 900 }}>365</span>
            </div>
            {state.shopName !== 'Warung365' && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{state.shopName}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: compact ? 4 : 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{
            padding: compact ? '3px 8px' : '5px 12px', borderRadius: 16, fontSize: compact ? 10 : 11, fontWeight: 600,
            background: isLicenseValid() ? 'rgba(255,255,255,0.2)' : 'rgba(220,38,38,0.3)',
            color: '#FFFFFF', whiteSpace: 'nowrap',
          }}>
            {isLicenseValid() ? `🔑 ${licenseText}` : `⚠️ ${t('expired')}`}
          </div>
          <button style={{ ...styles.iconBtn, padding: compact ? '6px 8px' : '10px 12px', fontSize: compact ? 15 : 18 }} onClick={() => onNavigate('demo')}>🎬</button>
          <button style={{ ...styles.iconBtn, padding: compact ? '6px 8px' : '10px 12px', fontSize: compact ? 15 : 18 }} onClick={() => onNavigate('kds')}>📺</button>
          <button style={{ ...styles.iconBtn, padding: compact ? '6px 8px' : '10px 12px', fontSize: compact ? 15 : 18 }} onClick={() => onNavigate('sync')}>📡</button>
          <button style={{ ...styles.iconBtn, padding: compact ? '6px 8px' : '10px 12px', fontSize: compact ? 15 : 18 }} onClick={() => onNavigate('reports')}>📊</button>
          <button style={{ ...styles.iconBtn, padding: compact ? '6px 8px' : '10px 12px', fontSize: compact ? 15 : 18 }} onClick={() => onNavigate('settings')}>⚙️</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ ...styles.statsBar, gap: compact ? 6 : 10, padding: compact ? '8px 10px' : '12px 18px' }}>
        <StatCard icon="🪑" label={t('occupied')} value={occupiedCount} color="#EF4444" compact={compact} />
        <StatCard icon="📦" label={t('takeaway')} value={takeawayCount} color="#F59E0B" compact={compact} />
        <StatCard icon="💰" label={t('totalSales')} value={`RM ${todayRevenue.toFixed(2)}`} color="#FF6B2C" compact={compact} />
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <LegendItem color="var(--bg-card)" borderColor="var(--border)" label={t('emptyTable')} />
        <LegendItem color="#EF4444" label={t('occupied')} />
        <LegendItem color="#EAB308" label={t('served') || '已送餐'} />
        <LegendItem color="#22C55E" label={t('paid')} />
        <LegendItem color="#F59E0B" label={t('packaged')} />
      </div>

      {/* Grid */}
      <div style={styles.gridScroll}>
        <div style={{ ...styles.grid, gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(90px, 1fr))' : 'repeat(auto-fill, minmax(110px, 1fr))', gap: compact ? 8 : 12 }}>
          {state.tables.map(table => {
            const isServed = servedTableIds.has(table.id)
            const st = isServed
              ? { bg: 'linear-gradient(135deg, #EAB308, #CA8A04)', border: '#EAB308', numColor: '#FFFFFF', labelColor: '#FEF9C3' }
              : TABLE_STYLES[table.status]
            const orderCount = table.orderIds.length
            return (
              <button key={table.id}
                onClick={() => handleTableClick(table)}
                onContextMenu={e => { e.preventDefault(); handleTableLongPress(table) }}
                style={{ ...styles.tableCell, background: st.bg, borderColor: st.border }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: st.numColor }}>{table.id}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: st.labelColor, marginTop: 4 }}>
                  {isServed ? `🍽️ ${t('served') || '已送餐'}` : getLabel(table)}
                </div>
                {orderCount > 0 && (
                  <div style={styles.itemBadge}>
                    {orderCount > 1
                      ? `${orderCount}${t('order')}`
                      : (state.orders[table.orderIds[0]]?.items?.length || 0)
                    }
                  </div>
                )}
                {readyTableIds.has(table.id) && !isServed && (
                  <div style={styles.readyBadge}>✅</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active takeaway orders panel — always visible so workers can create takeaway */}
      <div style={taStyles.panel}>
        <div style={taStyles.header}>
          <span>📦 {t('takeaway')} {activeTakeawayOrders.length > 0 ? `(${activeTakeawayOrders.length})` : ''}</span>
          <button style={taStyles.newBtn} onClick={() => onNavigate('menu', { tableId: 0, orderType: 'takeaway' })}>
            + {t('new') || '新增'}
          </button>
        </div>
        {activeTakeawayOrders.length === 0 ? (
          <div style={{ color: 'var(--text-light)', fontSize: 12, padding: '2px 0' }}>
            — {t('noItems') || '暂无打包单'}
          </div>
        ) : (
          <div style={taStyles.list}>
            {activeTakeawayOrders.map(o => {
              const allKdsReady = o.items.length > 0 && o.items.every(i => i.kdsStatus === 'ready')
              const total = o.items.reduce((s, i) => s + i.price * i.qty, 0)
              return (
                <div key={o.id} style={taStyles.item}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                      #{o.id.slice(0, 6).toUpperCase()}
                      {allKdsReady && <span style={{ color: '#16A34A', marginLeft: 6 }}>✅ {t('readyToServe')}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>
                      {o.items.length} {t('itemOf')} · RM {total.toFixed(2)}
                    </div>
                  </div>
                  <button style={taStyles.viewBtn} onClick={() => onNavigate('order', { orderId: o.id, tableId: 0 })}>
                    {t('view') || '查看'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Worker: direct push "food ready" notification banners */}
      {state.serverMode === 'sub' && state.readyNotifications?.length > 0 && (
        <div style={notifyStyles.panel}>
          <div style={notifyStyles.header}>
            <span style={notifyStyles.headerIcon}>🔔</span>
            <span style={notifyStyles.headerText}>{t('readyToServe')}</span>
            <button
              onClick={() => dispatch({ type: 'LOAD_STATE', payload: { readyNotifications: [] } })}
              style={{ marginLeft: 'auto', background: 'none', color: '#fff', fontSize: 18, padding: '0 4px' }}
            >✕</button>
          </div>
          <div style={notifyStyles.list}>
            {state.readyNotifications.map((n, i) => (
              <div key={i} style={notifyStyles.item}>
                <div style={notifyStyles.itemInfo}>
                  <div style={notifyStyles.itemTable}>
                    {n.tableId === 0 ? `📦 ${t('takeaway')}` : `🪑 ${t('tableNo')} ${n.tableId}`}
                  </div>
                  <div style={notifyStyles.itemSummary}>
                    {n.itemSummary && n.itemSummary.length > 40 ? n.itemSummary.slice(0, 40) + '...' : n.itemSummary}
                  </div>
                </div>
                <span style={{ fontSize: 24 }}>✅</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready to serve — host + worker phones; confirm marks table yellow for everyone after sync */}
      {readyToServeOrders.length > 0 && (
        <div style={notifyStyles.panel}>
          <div style={notifyStyles.header}>
            <span style={notifyStyles.headerIcon}>🔔</span>
            <span style={notifyStyles.headerText}>
              {readyToServeOrders.length} {t('deliveryCount')}
            </span>
          </div>
          <div style={notifyStyles.list}>
            {dineInReadyGroups.map(([tableId, orders]) => {
              const ids = orders.map(o => o.orderId)
              const summary = orders.map(o => o.itemSummary.slice(0, 28) + (o.itemSummary.length > 28 ? '…' : '')).join(' · ')
              return (
                <div key={`t-${tableId}`} style={notifyStyles.item}>
                  <div style={notifyStyles.itemInfo}>
                    <div style={notifyStyles.itemTable}>
                      🪑 {t('tableNo')} {tableId}
                      {orders.length > 1 && (
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginLeft: 6 }}>
                          · {orders.length} {t('order')}
                        </span>
                      )}
                    </div>
                    <div style={notifyStyles.itemSummary}>
                      {summary.length > 80 ? `${summary.slice(0, 80)}…` : summary}
                    </div>
                  </div>
                  <button
                    type="button"
                    style={notifyStyles.serveBtn}
                    onClick={() => handleConfirmDelivered(ids, [tableId])}
                  >
                    🍽️ {t('confirmDelivered')}
                  </button>
                </div>
              )
            })}
            {takeawayReadyOrders.map(o => (
              <div key={o.orderId} style={notifyStyles.item}>
                <div style={notifyStyles.itemInfo}>
                  <div style={notifyStyles.itemTable}>
                    📦 {t('takeaway')} #{o.orderId.slice(0, 6).toUpperCase()}
                  </div>
                  <div style={notifyStyles.itemSummary}>
                    {o.items.length} {t('itemOf')} · {o.itemSummary.length > 35 ? o.itemSummary.slice(0, 35) + '...' : o.itemSummary}
                  </div>
                </div>
                <button
                  type="button"
                  style={notifyStyles.serveBtn}
                  onClick={() => handleConfirmDelivered([o.orderId], [0])}
                >
                  🍽️ {t('confirmDelivered')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Picker Modal */}
      {showOrderPicker && pickerTable && (
        <div onClick={() => setShowOrderPicker(null)} style={pickerStyles.overlay}>
          <div onClick={e => e.stopPropagation()} style={pickerStyles.box}>
            <h3 style={pickerStyles.title}>
              🪑 {t('tableNo')} {pickerTable.id}
              {pickerOrders.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 400 }}>
                  {' '}· {pickerOrders.length} {t('order')}
                </span>
              )}
            </h3>

            {pickerOrders.length > 0 && pickerOrders.every(o => !o.items?.length) && (
              <button
                type="button"
                style={pickerStyles.releaseEmptyBtn}
                onClick={() => {
                  pickerOrders.forEach(o => {
                    dispatch({ type: 'CANCEL_ORDER', payload: { orderId: o.id, tableId: pickerTable.id } })
                  })
                  setShowOrderPicker(null)
                  SoundService.tapSound()
                }}
              >
                🪑 {t('releaseEmptyTable')}
              </button>
            )}

            {pickerOrders.map((order, idx) => {
              const orderTotal = order.items.reduce((s, i) => s + i.price * i.qty, 0)
              return (
                <button key={order.id} style={pickerStyles.orderBtn}
                  onClick={() => {
                    setShowOrderPicker(null)
                    onNavigate('order', { orderId: order.id, tableId: pickerTable.id })
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={pickerStyles.orderBadge}>{String.fromCharCode(65 + idx)}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600 }}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
                        {order.items.length} {t('item')} · {new Date(order.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 700 }}>
                    RM {orderTotal.toFixed(2)}
                  </div>
                </button>
              )
            })}

            <button style={pickerStyles.newOrderBtn}
              onClick={() => {
                setShowOrderPicker(null)
                onNavigate('menu', { tableId: pickerTable.id, orderType: 'dine_in' })
              }}>
              <span style={{ fontSize: 20 }}>➕</span>
              <span style={{ fontWeight: 700 }}>{t('shareTable')}</span>
            </button>

            <button style={pickerStyles.closeBtn} onClick={() => setShowOrderPicker(null)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, color, compact }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: compact ? 6 : 10,
      background: 'var(--bg-card)', padding: compact ? '8px 8px' : '10px 14px', borderRadius: 12,
      border: '1px solid var(--border)', minWidth: compact ? 80 : 120, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: compact ? 28 : 36, height: compact ? 28 : 36, borderRadius: compact ? 8 : 10,
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact ? 14 : 18,
        flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: compact ? 10 : 11, color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
        <div style={{ fontSize: compact ? 13 : 15, color: 'var(--text)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
    </div>
  )
}

function LegendItem({ color, borderColor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 14, height: 14, borderRadius: 4, background: color, border: borderColor ? `1px solid ${borderColor}` : 'none' }} />
      <span style={{ color: 'var(--text-light)', fontSize: 12 }}>{label}</span>
    </div>
  )
}

const notifyStyles = {
  panel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    background: 'var(--bg-card)', borderTop: '3px solid #16A34A',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
    animation: 'slideUp 0.3s', zIndex: 50,
    maxHeight: '35vh', overflow: 'auto',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 16px', background: '#DCFCE7',
    borderBottom: '1px solid #BBF7D0',
  },
  headerIcon: { fontSize: 18 },
  headerText: { fontSize: 14, fontWeight: 700, color: '#15803D' },
  list: { padding: '6px 12px' },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 12, marginBottom: 6,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    gap: 10,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTable: { fontSize: 14, fontWeight: 700, color: 'var(--text)' },
  itemSummary: {
    fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  serveBtn: {
    background: 'linear-gradient(135deg, #16A34A, #15803D)',
    color: '#FFFFFF', padding: '10px 18px', borderRadius: 10,
    fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
    flexShrink: 0,
  },
}

const pickerStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    zIndex: 100, animation: 'fadeIn 0.15s',
  },
  box: {
    width: '100%', maxWidth: 520, background: 'var(--bg-card)',
    borderRadius: '20px 20px 0 0', padding: 20,
    animation: 'slideUp 0.25s', borderTop: '3px solid var(--primary)',
    maxHeight: '80vh', overflow: 'auto',
  },
  title: { color: 'var(--text)', fontSize: 18, margin: '0 0 16px', textAlign: 'center', fontWeight: 700 },
  orderBtn: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 16px', borderRadius: 12, marginBottom: 8,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
  },
  orderBadge: {
    width: 36, height: 36, borderRadius: 18,
    background: 'var(--primary)', color: '#FFFFFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 800,
  },
  releaseEmptyBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '14px 16px', borderRadius: 12, marginBottom: 10,
    background: 'rgba(239,68,68,0.12)', border: '2px solid #EF4444',
    color: '#DC2626', fontSize: 15, fontWeight: 700,
  },
  newOrderBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '16px', borderRadius: 12, marginTop: 8,
    background: 'var(--primary-light)', border: '2px dashed var(--primary)',
    color: 'var(--primary)', fontSize: 15,
  },
  closeBtn: {
    width: '100%', padding: 12, marginTop: 10,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text-light)', fontSize: 14,
  },
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', background: 'var(--grad-header)',
    boxShadow: '0 4px 12px rgba(255,107,44,0.2)',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  brandIcon: {
    width: 44, height: 44, borderRadius: 14,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, border: '2px solid rgba(255,255,255,0.3)',
  },
  shopName: { fontSize: 22, fontWeight: 800, display: 'flex', gap: 4 },
  headerRight: { display: 'flex', gap: 8, alignItems: 'center' },
  iconBtn: {
    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: 10, padding: '10px 12px', fontSize: 18, color: '#FFFFFF',
  },
  statsBar: {
    display: 'flex', gap: 10, padding: '12px 18px',
    background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', overflowX: 'auto',
  },
  legend: {
    display: 'flex', gap: 20, padding: '10px 20px', flexWrap: 'wrap',
    borderBottom: '1px solid var(--border)', background: 'var(--bg-card)',
  },
  gridScroll: { flex: 1, overflow: 'auto', padding: 16 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12,
  },
  tableCell: {
    position: 'relative', aspectRatio: '1/1', borderRadius: 14,
    border: '2px solid', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s', minHeight: 100, boxShadow: 'var(--shadow-sm)',
  },
  itemBadge: {
    position: 'absolute', top: 6, right: 6,
    background: 'var(--primary)', color: '#FFFFFF',
    minWidth: 24, height: 24, borderRadius: 12, padding: '0 6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 800,
  },
  readyBadge: {
    position: 'absolute', bottom: 6, right: 6,
    fontSize: 16,
  },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    background: 'var(--grad-primary)', color: '#FFFFFF',
    borderRadius: 28, padding: '14px 24px', fontSize: 15, fontWeight: 800,
    boxShadow: '0 6px 20px rgba(255,107,44,0.4)',
  },
}

const taStyles = {
  panel: {
    background: 'var(--bg-card)', borderTop: '3px solid #F59E0B',
    padding: '8px 12px', borderRadius: 0,
  },
  header: {
    fontSize: 13, fontWeight: 700, color: '#D97706',
    marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  newBtn: {
    background: '#F59E0B', color: '#FFFFFF',
    padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 6 },
  item: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
    padding: '8px 12px', gap: 10,
  },
  viewBtn: {
    background: 'var(--grad-gold)', color: 'var(--primary-dark)',
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    flexShrink: 0,
  },
}
