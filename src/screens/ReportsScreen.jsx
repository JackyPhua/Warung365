// src/screens/ReportsScreen.jsx
import React, { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'

export default function ReportsScreen({ onNavigate }) {
  const { state, dispatch, t } = useApp()
  const [tab, setTab] = useState('daily')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [searchQuery, setSearchQuery] = useState('')
  const [showExport, setShowExport] = useState(false)

  const orders = state.completedOrders.filter(o => !o.refunded)

  const daily = useMemo(() => {
    const dateStr = selectedDate.toDateString()
    let dayOrders = orders.filter(o => new Date(o.completedAt).toDateString() === dateStr)
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      dayOrders = dayOrders.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q)) ||
        String(o.tableId).includes(q)
      )
    }
    const total = dayOrders.reduce((s, o) => s + ((o.payment?.received || 0) - (o.payment?.change || 0)), 0)
    const itemMap = {}
    dayOrders.forEach(o => {
      o.items.forEach(item => {
        if (!itemMap[item.name]) itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 }
        itemMap[item.name].qty += item.qty
        itemMap[item.name].revenue += item.price * item.qty
      })
    })
    return {
      orders: dayOrders, total, count: dayOrders.length,
      avg: dayOrders.length ? total / dayOrders.length : 0,
      topItems: Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    }
  }, [orders, selectedDate, searchQuery])

  const monthly = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const monthOrders = orders.filter(o => {
      const d = new Date(o.completedAt)
      return d.getFullYear() === year && d.getMonth() === month
    })
    const byDay = {}
    monthOrders.forEach(o => {
      const day = new Date(o.completedAt).getDate()
      if (!byDay[day]) byDay[day] = { day, count: 0, total: 0 }
      byDay[day].count++
      byDay[day].total += ((o.payment?.received || 0) - (o.payment?.change || 0))
    })
    const total = monthOrders.reduce((s, o) => s + ((o.payment?.received || 0) - (o.payment?.change || 0)), 0)
    return {
      total, count: monthOrders.length,
      avg: monthOrders.length ? total / monthOrders.length : 0,
      byDay: Object.values(byDay).sort((a, b) => a.day - b.day),
    }
  }, [orders, selectedDate])

  const handleRefund = (order) => {
    const amount = (order.payment?.received || 0) - (order.payment?.change || 0)
    if (confirm(`${t('refund')} RM ${amount.toFixed(2)}?`))
      dispatch({ type: 'REFUND_ORDER', payload: { completedOrderId: order.id } })
  }

  const changeDate = (dir) => {
    const d = new Date(selectedDate)
    if (tab === 'daily') d.setDate(d.getDate() + dir)
    else d.setMonth(d.getMonth() + dir)
    setSelectedDate(d)
  }

  const dateLabel = tab === 'daily'
    ? selectedDate.toLocaleDateString('en-GB')
    : selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const current = tab === 'daily' ? daily : monthly

  // ── Export functions ──
  const exportJSON = () => {
    const data = {
      shopName: state.shopName,
      storeId: state.storeId,
      exportDate: new Date().toISOString(),
      completedOrders: state.completedOrders,
      menu: state.menu,
      settings: {
        language: state.language,
        tableCount: state.tableCount,
        cookingMethodPrices: state.cookingMethodPrices,
      },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `warung365_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    alert('✅ JSON exported!')
  }

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Order ID', 'Table', 'Items', 'Total (RM)', 'Received (RM)', 'Change (RM)', 'Refunded']
    const rows = state.completedOrders.map(o => {
      const d = new Date(o.completedAt)
      const total = (o.payment?.received || 0) - (o.payment?.change || 0)
      const items = o.items.map(i => `${i.qty}x ${i.name}`).join('; ')
      return [
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        o.id.substring(0, 8).toUpperCase(),
        o.tableId === 0 ? 'Takeaway' : `Table ${o.tableId}`,
        `"${items}"`,
        total.toFixed(2),
        (o.payment?.received || 0).toFixed(2),
        (o.payment?.change || 0).toFixed(2),
        o.refunded ? 'Yes' : 'No',
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `warung365_sales_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    alert('✅ CSV exported!')
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => onNavigate('tables')}>← {t('back')}</button>
        <div style={{ color: 'var(--primary)', fontSize: 16, fontWeight: 700 }}>📊 {t('report')}</div>
        <button style={styles.exportBtn} onClick={() => setShowExport(true)}>📥</button>
      </div>

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(tab === 'daily' ? styles.tabActive : {}) }}
          onClick={() => setTab('daily')}>📅 {t('dailyReport')}</button>
        <button style={{ ...styles.tab, ...(tab === 'monthly' ? styles.tabActive : {}) }}
          onClick={() => setTab('monthly')}>📆 {t('monthlyReport')}</button>
      </div>

      <div style={styles.dateNav}>
        <button style={styles.navBtn} onClick={() => changeDate(-1)}>◀</button>
        <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 700, margin: '0 20px' }}>{dateLabel}</div>
        <button style={styles.navBtn} onClick={() => changeDate(1)}>▶</button>
      </div>

      {/* Search bar (daily only) */}
      {tab === 'daily' && (
        <div style={{ padding: '0 16px 10px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <input
            style={styles.searchInput}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 搜索订单号/菜名/桌号..."
          />
        </div>
      )}

      <div style={styles.scroll}>
        <div style={styles.summary}>
          <SummaryCard label={t('totalSales')} value={`RM ${current.total.toFixed(2)}`} icon="💰" color="var(--primary)" />
          <SummaryCard label={t('totalOrders')} value={current.count} icon="📋" color="#16A34A" />
          <SummaryCard label={t('avgOrder')} value={`RM ${current.avg.toFixed(2)}`} icon="📊" color="#F59E0B" />
        </div>

        {tab === 'daily' ? (
          <>
            {daily.topItems.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>🏆 热销榜</div>
                {daily.topItems.map((item, i) => (
                  <div key={i} style={styles.rankRow}>
                    <div style={{
                      ...styles.rankBadge,
                      background: i === 0 ? 'var(--grad-primary)' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--bg-lighter)',
                      color: i < 3 ? '#FFFFFF' : 'var(--text)',
                    }}>{i + 1}</div>
                    <span style={{ flex: 1, color: 'var(--text)', fontSize: 13 }}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginRight: 10 }}>×{item.qty}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>RM {item.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                📋 {t('order')} ({daily.count})
                {searchQuery && <span style={{ color: 'var(--primary)', fontSize: 12 }}> — "{searchQuery}"</span>}
              </div>
              {daily.orders.length === 0 ? (
                <div style={styles.empty}>{searchQuery ? '没有找到匹配的订单' : t('noItems')}</div>
              ) : daily.orders.map(order => {
                const paid = (order.payment?.received || 0) - (order.payment?.change || 0)
                const time = new Date(order.completedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                return (
                  <div key={order.id} style={styles.orderRow}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--primary)', fontSize: 12, fontWeight: 600 }}>
                        #{order.id.substring(0, 8).toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2 }}>
                        {time} · {order.tableId === 0 ? t('takeaway') : `${t('tableNo')} ${order.tableId}`}
                      </div>
                      <div style={{ color: 'var(--text-light)', fontSize: 11, marginTop: 2 }}>
                        {order.items.map(i => `${i.qty}x ${i.name}`).join(', ')}
                      </div>
                    </div>
                    <span style={{ color: 'var(--primary)', fontSize: 15, fontWeight: 700, marginRight: 10 }}>
                      RM {paid.toFixed(2)}
                    </span>
                    {order.refunded ? (
                      <span style={{ fontSize: 16 }}>↩️</span>
                    ) : (
                      <button style={styles.refundBtn} onClick={() => handleRefund(order)}>
                        {t('refund')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📊 每日销售</div>
            {monthly.byDay.length === 0 ? (
              <div style={styles.empty}>{t('noItems')}</div>
            ) : monthly.byDay.map(d => {
              const max = Math.max(...monthly.byDay.map(x => x.total), 1)
              const pct = (d.total / max) * 100
              return (
                <div key={d.day} style={styles.barRow}>
                  <span style={{ color: 'var(--text-light)', fontSize: 12, width: 28, fontWeight: 600 }}>{d.day}</span>
                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: `${pct}%` }} />
                  </div>
                  <span style={{ color: 'var(--primary)', fontSize: 12, width: 85, textAlign: 'right', fontWeight: 700 }}>
                    RM {d.total.toFixed(0)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExport && (
        <div onClick={() => setShowExport(false)} style={expStyles.overlay}>
          <div onClick={e => e.stopPropagation()} style={expStyles.box}>
            <h3 style={{ color: 'var(--primary)', fontSize: 18, margin: '0 0 16px', textAlign: 'center', fontWeight: 700 }}>
              📥 数据导出 / Export
            </h3>

            <button style={expStyles.optionBtn} onClick={exportCSV}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>📊 导出 CSV</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  可用 Excel / Google Sheets 打开
                </div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </button>

            <button style={expStyles.optionBtn} onClick={exportJSON}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>💾 导出 JSON（完整备份）</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  包含订单 + 菜单 + 设置，可恢复
                </div>
              </div>
              <span style={{ fontSize: 20 }}>→</span>
            </button>

            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 12, textAlign: 'center' }}>
              共 {state.completedOrders.length} 笔订单
            </div>

            <button style={expStyles.closeBtn} onClick={() => setShowExport(false)}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, color }) {
  return (
    <div style={{
      flex: 1, padding: 14, borderRadius: 14,
      background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}18`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>{icon}</div>
        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{label}</div>
      </div>
      <div style={{ fontSize: 20, color, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

const expStyles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.15s',
  },
  box: {
    width: '100%', maxWidth: 520, background: 'var(--bg-card)',
    borderRadius: '20px 20px 0 0', padding: 20, animation: 'slideUp 0.25s',
    borderTop: '3px solid var(--primary)',
  },
  optionBtn: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px', borderRadius: 12, marginBottom: 10,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    color: 'var(--text)', textAlign: 'left',
  },
  closeBtn: {
    width: '100%', padding: 12, marginTop: 8,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    borderRadius: 10, color: 'var(--text-light)', fontSize: 14,
  },
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  backBtn: { background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 10, fontSize: 14 },
  exportBtn: { background: 'var(--primary-light)', border: '1px solid var(--primary)', padding: '8px 14px', borderRadius: 10, fontSize: 18 },
  tabs: { display: 'flex', background: 'var(--bg-card)', padding: '0 18px', borderBottom: '1px solid var(--border)' },
  tab: { flex: 1, padding: '12px 16px', background: 'transparent', color: 'var(--text-light)', fontSize: 14, borderBottom: '3px solid transparent', fontWeight: 500 },
  tabActive: { color: 'var(--primary)', borderBottomColor: 'var(--primary)', fontWeight: 700 },
  dateNav: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 14, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
  },
  navBtn: { background: 'var(--bg-lighter)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 14px', borderRadius: 8, fontSize: 14 },
  searchInput: {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text)', boxSizing: 'border-box',
  },
  scroll: { flex: 1, overflow: 'auto', padding: 14 },
  summary: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 },
  section: { background: 'var(--bg-card)', borderRadius: 14, padding: 16, marginBottom: 12, border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' },
  sectionTitle: { color: 'var(--text)', fontSize: 14, fontWeight: 700, marginBottom: 12 },
  empty: { color: 'var(--text-muted)', textAlign: 'center', padding: 30 },
  rankRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, background: 'var(--bg-lighter)', borderRadius: 10 },
  rankBadge: { width: 28, height: 28, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 },
  orderRow: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg-lighter)', borderRadius: 10, padding: 10, marginBottom: 6 },
  refundBtn: { background: 'var(--danger-light)', color: 'var(--danger)', padding: '6px 10px', borderRadius: 8, fontSize: 11, border: '1px solid var(--danger)', flexShrink: 0 },
  barRow: { display: 'flex', alignItems: 'center', marginBottom: 10 },
  barTrack: { flex: 1, height: 24, background: 'var(--bg-lighter)', borderRadius: 6, margin: '0 10px', overflow: 'hidden', border: '1px solid var(--border)' },
  barFill: { height: '100%', background: 'var(--grad-primary)', borderRadius: 6, transition: 'width 0.5s' },
}
