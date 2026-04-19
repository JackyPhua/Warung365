// src/screens/TableScreen.jsx
import React, { useState } from 'react'
import { useApp, TABLE_STATUS } from '../context/AppContext'

const TABLE_STYLES = {
  [TABLE_STATUS.EMPTY]: { bg: 'var(--bg-card)', border: 'var(--border)', numColor: 'var(--text)', labelColor: 'var(--text-muted)' },
  [TABLE_STATUS.OCCUPIED]: { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', border: '#EF4444', numColor: '#FFFFFF', labelColor: '#FFD4D4' },
  [TABLE_STATUS.PAID]: { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', border: '#22C55E', numColor: '#FFFFFF', labelColor: '#D1FAE5' },
  [TABLE_STATUS.TAKEAWAY]: { bg: 'linear-gradient(135deg, #F59E0B, #D97706)', border: '#F59E0B', numColor: '#FFFFFF', labelColor: '#FEF3C7' },
}

export default function TableScreen({ onNavigate }) {
  const { state, t, isLicenseValid, getLicenseDaysLeft, getTableOrders, getTableTotal } = useApp()
  const [showOrderPicker, setShowOrderPicker] = useState(null)

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

  const pickerTable = showOrderPicker ? state.tables.find(t => t.id === showOrderPicker) : null
  const pickerOrders = showOrderPicker ? getTableOrders(showOrderPicker) : []

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>🍱</div>
          <div>
            <div style={styles.shopName}>
              <span style={{ color: '#FFFFFF' }}>Warung</span>
              <span style={{ color: '#FFF3C7', fontWeight: 900 }}>365</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
              {state.shopName !== 'Warung365' ? state.shopName : ''}
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={{
            padding: '5px 12px', borderRadius: 16, fontSize: 11, fontWeight: 600,
            background: isLicenseValid() ? 'rgba(255,255,255,0.2)' : 'rgba(220,38,38,0.3)',
            color: '#FFFFFF',
          }}>
            {isLicenseValid() ? `🔑 ${licenseText}` : `⚠️ ${t('expired')}`}
          </div>
          <button style={styles.iconBtn} onClick={() => onNavigate('sync')}>📡</button>
          <button style={styles.iconBtn} onClick={() => onNavigate('reports')}>📊</button>
          <button style={styles.iconBtn} onClick={() => onNavigate('settings')}>⚙️</button>
        </div>
      </div>

      {/* Stats */}
      <div style={styles.statsBar}>
        <StatCard icon="🪑" label={t('occupied')} value={occupiedCount} color="#EF4444" />
        <StatCard icon="📦" label={t('takeaway')} value={takeawayCount} color="#F59E0B" />
        <StatCard icon="💰" label={t('totalSales')} value={`RM ${todayRevenue.toFixed(2)}`} color="#FF6B2C" />
        <StatCard icon="📋" label={t('totalOrders')} value={todayOrders.length} color="#16A34A" />
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <LegendItem color="var(--bg-card)" borderColor="var(--border)" label={t('emptyTable')} />
        <LegendItem color="#EF4444" label={t('occupied')} />
        <LegendItem color="#22C55E" label={t('paid')} />
        <LegendItem color="#F59E0B" label={t('packaged')} />
      </div>

      {/* Grid */}
      <div style={styles.gridScroll}>
        <div style={styles.grid}>
          {state.tables.map(table => {
            const st = TABLE_STYLES[table.status]
            const orderCount = table.orderIds.length
            return (
              <button key={table.id}
                onClick={() => handleTableClick(table)}
                onContextMenu={e => { e.preventDefault(); handleTableLongPress(table) }}
                style={{ ...styles.tableCell, background: st.bg, borderColor: st.border }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: st.numColor }}>{table.id}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: st.labelColor, marginTop: 4 }}>{getLabel(table)}</div>
                {orderCount > 0 && (
                  <div style={styles.itemBadge}>
                    {orderCount > 1
                      ? `${orderCount}${t('order')}`
                      : (state.orders[table.orderIds[0]]?.items?.length || 0)
                    }
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* FAB */}
      <button style={styles.fab} onClick={() => onNavigate('menu', { tableId: 0, orderType: 'takeaway' })}>
        📦 {t('takeaway')}
      </button>

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

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12,
      border: '1px solid var(--border)', minWidth: 120, boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{label}</div>
        <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 700 }}>{value}</div>
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
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    background: 'var(--grad-primary)', color: '#FFFFFF',
    borderRadius: 28, padding: '14px 24px', fontSize: 15, fontWeight: 800,
    boxShadow: '0 6px 20px rgba(255,107,44,0.4)',
  },
}
