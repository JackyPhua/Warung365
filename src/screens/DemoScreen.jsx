// src/screens/DemoScreen.jsx
import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

const DEMO_ORDERS = [
  {
    id: 'demo-001',
    tableId: 3,
    type: 'dine_in',
    items: [
      { id: 'd1', name: '云吞面 (幼面, 干捞) [堂食]', price: 7, qty: 1, department: 'food', kdsStatus: 'pending' },
      { id: 'd2', name: '鸡饭 (大份) [堂食]', price: 9, qty: 1, department: 'food', kdsStatus: 'pending' },
      { id: 'd3', name: 'Teh O (冰, 少糖) [堂食]', price: 2.3, qty: 2, department: 'beverage', kdsStatus: 'pending' },
    ],
  },
  {
    id: 'demo-002',
    tableId: 7,
    type: 'dine_in',
    items: [
      { id: 'd4', name: '炒饭 (小份) [堂食]', price: 7, qty: 1, department: 'food', kdsStatus: 'pending' },
      { id: 'd5', name: '虾饼 [堂食]', price: 4, qty: 2, department: 'food', kdsStatus: 'pending' },
      { id: 'd6', name: 'Milo (冰, 正常甜) [堂食]', price: 3, qty: 1, department: 'beverage', kdsStatus: 'pending' },
      { id: 'd7', name: 'Kopi O (热, 无糖) [堂食]', price: 1.8, qty: 1, department: 'beverage', kdsStatus: 'pending' },
    ],
  },
]

const STEPS = [
  {
    key: 'order',
    title: { zh: '① 服务员下单', en: '① Waiter places order', ms: '① Pelayan buat pesanan' },
    desc: {
      zh: '服务员在 POS 上输入桌 3 和桌 7 的订单，食物和饮料项目自动标记所属部门。',
      en: 'Waiter enters orders for Table 3 & 7 on POS. Food and drink items are auto-tagged by department.',
      ms: 'Pelayan memasukkan pesanan Meja 3 & 7. Item makanan dan minuman ditag automatik.',
    },
    highlight: 'cashier',
  },
  {
    key: 'kds_appear',
    title: { zh: '② 订单自动分配到各部门', en: '② Orders auto-route to departments', ms: '② Pesanan diagih ke jabatan' },
    desc: {
      zh: '食物部的平板只看到食物项目，饮料部的平板只看到饮料项目。各做各的，互不干扰。',
      en: 'Food dept tablet sees only food items. Beverage dept tablet sees only drinks. Each works independently.',
      ms: 'Tablet makanan hanya nampak item makanan. Tablet minuman hanya nampak minuman.',
    },
    highlight: 'both_kds',
  },
  {
    key: 'bev_done',
    title: { zh: '③ 饮料部完成桌 3', en: '③ Beverage dept finishes Table 3', ms: '③ Jabatan minuman siap Meja 3' },
    desc: {
      zh: '饮料部做好桌 3 的 2 杯 Teh O，按"全部完成"。但桌 3 的食物还没好，所以还不能送。',
      en: 'Beverage dept finishes 2x Teh O for Table 3, taps "All Done". But food isn\'t ready yet — can\'t serve.',
      ms: 'Minuman siap 2x Teh O Meja 3, tekan "Semua Siap". Tapi makanan belum — tak boleh hidang lagi.',
    },
    highlight: 'bev_kds',
    action: (orders) => orders.map(o =>
      o.id === 'demo-001'
        ? { ...o, items: o.items.map(i => i.department === 'beverage' ? { ...i, kdsStatus: 'ready' } : i) }
        : o
    ),
  },
  {
    key: 'food_done_t3',
    title: { zh: '④ 食物部完成桌 3', en: '④ Food dept finishes Table 3', ms: '④ Jabatan makanan siap Meja 3' },
    desc: {
      zh: '食物部做好云吞面和鸡饭，按"全部完成"。现在桌 3 的全部菜品已就绪！',
      en: 'Food dept finishes wanton mee & chicken rice, taps "All Done". Table 3 is now fully ready!',
      ms: 'Makanan siap mee wantan & nasi ayam, tekan "Semua Siap". Meja 3 sedia sepenuhnya!',
    },
    highlight: 'food_kds',
    action: (orders) => orders.map(o =>
      o.id === 'demo-001'
        ? { ...o, items: o.items.map(i => i.department === 'food' ? { ...i, kdsStatus: 'ready' } : i) }
        : o
    ),
  },
  {
    key: 'notify',
    title: { zh: '⑤ 服务员收到通知', en: '⑤ Waiter gets notification', ms: '⑤ Pelayan terima notifikasi' },
    desc: {
      zh: '服务员的手机/平板主页底部弹出通知：「桌 3 可上菜」，铃声提醒。正在点单的服务员不会被打扰，回主页才看到。',
      en: 'Waiter\'s home screen shows notification: "Table 3 ready to serve" with a chime. Waiters taking orders won\'t be interrupted.',
      ms: 'Skrin utama pelayan menunjukkan notifikasi: "Meja 3 sedia" dengan bunyi. Pelayan yang ambil pesanan tak diganggu.',
    },
    highlight: 'waiter',
  },
  {
    key: 'serve',
    title: { zh: '⑥ 服务员送餐', en: '⑥ Waiter delivers food', ms: '⑥ Pelayan menghantar makanan' },
    desc: {
      zh: '服务员按"送出"，通知消失。厨房显示也自动清理已送出的订单。桌 7 的订单还在厨房继续处理。',
      en: 'Waiter taps "Serve" — notification clears. KDS auto-removes served orders. Table 7 continues in kitchen.',
      ms: 'Pelayan tekan "Hidang" — notifikasi hilang. KDS membuang pesanan yang dihidang. Meja 7 masih di dapur.',
    },
    highlight: 'waiter',
    action: (orders) => orders.map(o =>
      o.id === 'demo-001'
        ? { ...o, items: o.items.map(i => ({ ...i, kdsStatus: 'served' })) }
        : o
    ),
  },
  {
    key: 'done',
    title: { zh: '⑦ 完整流程结束', en: '⑦ Workflow complete', ms: '⑦ Aliran kerja selesai' },
    desc: {
      zh: '每个部门只看到自己的任务、做完就按完成、服务员自动收到通知送餐。全程零喊单，减少出错！',
      en: 'Each department sees only their tasks, marks done when ready, waiter auto-notified. Zero shouting, fewer mistakes!',
      ms: 'Setiap jabatan nampak tugas sendiri, tekan siap, pelayan diberitahu automatik. Tiada menjerit, kurang kesilapan!',
    },
    highlight: 'all',
  },
]

export default function DemoScreen({ onNavigate }) {
  const { state } = useApp()
  const lang = state.language
  const [step, setStep] = useState(0)
  const [orders, setOrders] = useState(JSON.parse(JSON.stringify(DEMO_ORDERS)))

  const currentStep = STEPS[step]
  const canNext = step < STEPS.length - 1
  const canPrev = step > 0

  const goNext = () => {
    if (!canNext) return
    const nextStep = STEPS[step + 1]
    if (nextStep.action) {
      setOrders(prev => nextStep.action(prev))
    }
    setStep(step + 1)
  }

  const goPrev = () => {
    if (!canPrev) return
    setOrders(JSON.parse(JSON.stringify(DEMO_ORDERS)))
    const newStep = step - 1
    let rebuilt = JSON.parse(JSON.stringify(DEMO_ORDERS))
    for (let i = 1; i <= newStep; i++) {
      if (STEPS[i].action) rebuilt = STEPS[i].action(rebuilt)
    }
    setOrders(rebuilt)
    setStep(newStep)
  }

  const reset = () => {
    setOrders(JSON.parse(JSON.stringify(DEMO_ORDERS)))
    setStep(0)
  }

  const t3 = orders.find(o => o.id === 'demo-001')
  const t7 = orders.find(o => o.id === 'demo-002')

  const t3AllReady = t3.items.every(i => i.kdsStatus === 'ready')
  const t3Served = t3.items.every(i => i.kdsStatus === 'served')

  const foodItems = orders.flatMap(o =>
    o.items.filter(i => i.department === 'food' && i.kdsStatus !== 'served').map(i => ({ ...i, tableId: o.tableId }))
  )
  const bevItems = orders.flatMap(o =>
    o.items.filter(i => i.department === 'beverage' && i.kdsStatus !== 'served').map(i => ({ ...i, tableId: o.tableId }))
  )

  const readyOrders = orders.filter(o => {
    const hasKds = o.items.some(i => i.kdsStatus)
    return hasKds && o.items.every(i => i.kdsStatus === 'ready')
  })

  const hl = currentStep.highlight

  return (
    <div style={S.container}>
      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => onNavigate('tables')}>
          ← {lang === 'zh' ? '退出' : lang === 'ms' ? 'Keluar' : 'Exit'}
        </button>
        <div style={S.headerTitle}>
          {lang === 'zh' ? 'KDS 厨房显示系统 — 互动演示' : lang === 'ms' ? 'KDS Paparan Dapur — Demo Interaktif' : 'KDS Kitchen Display — Interactive Demo'}
        </div>
        <button style={S.resetBtn} onClick={reset}>
          {lang === 'zh' ? '重新开始' : lang === 'ms' ? 'Mula Semula' : 'Restart'}
        </button>
      </div>

      {/* 4-panel grid */}
      <div style={S.panelGrid}>
        {/* Panel 1: Cashier / Orders */}
        <div style={{ ...S.panel, borderColor: (hl === 'cashier' || hl === 'all') ? '#FF6B2C' : 'var(--border)' }}>
          <div style={{ ...S.panelHeader, background: (hl === 'cashier' || hl === 'all') ? '#FF6B2C' : 'var(--text-muted)' }}>
            {lang === 'zh' ? '收银台 (POS)' : 'Cashier (POS)'}
          </div>
          <div style={S.panelBody}>
            {orders.filter(o => !o.items.every(i => i.kdsStatus === 'served')).map(o => (
              <div key={o.id} style={S.miniOrder}>
                <div style={S.miniOrderHeader}>
                  <span style={{ fontWeight: 700 }}>Table {o.tableId}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{o.items.length} items</span>
                </div>
                {o.items.map(i => (
                  <div key={i.id} style={S.miniItem}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
                      background: i.department === 'food' ? '#E53935' : '#2196F3',
                    }} />
                    <span style={{
                      fontSize: 12, color: 'var(--text)',
                      textDecoration: i.kdsStatus === 'served' ? 'line-through' : 'none',
                      opacity: i.kdsStatus === 'served' ? 0.4 : 1,
                    }}>
                      {i.qty}x {i.name.split(' [')[0]}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Food KDS */}
        <div style={{ ...S.panel, borderColor: (hl === 'food_kds' || hl === 'both_kds' || hl === 'all') ? '#E53935' : 'var(--border)' }}>
          <div style={{ ...S.panelHeader, background: (hl === 'food_kds' || hl === 'both_kds' || hl === 'all') ? '#E53935' : 'var(--text-muted)' }}>
            {lang === 'zh' ? '食物部 KDS' : lang === 'ms' ? 'KDS Makanan' : 'Food KDS'}
          </div>
          <div style={S.panelBody}>
            {foodItems.length === 0 ? (
              <div style={S.emptyPanel}>{lang === 'zh' ? '暂无待处理' : 'No pending items'}</div>
            ) : (
              <KdsItemList items={foodItems} color="#E53935" lang={lang} />
            )}
          </div>
        </div>

        {/* Panel 3: Beverage KDS */}
        <div style={{ ...S.panel, borderColor: (hl === 'bev_kds' || hl === 'both_kds' || hl === 'all') ? '#2196F3' : 'var(--border)' }}>
          <div style={{ ...S.panelHeader, background: (hl === 'bev_kds' || hl === 'both_kds' || hl === 'all') ? '#2196F3' : 'var(--text-muted)' }}>
            {lang === 'zh' ? '饮料部 KDS' : lang === 'ms' ? 'KDS Minuman' : 'Beverage KDS'}
          </div>
          <div style={S.panelBody}>
            {bevItems.length === 0 ? (
              <div style={S.emptyPanel}>{lang === 'zh' ? '暂无待处理' : 'No pending items'}</div>
            ) : (
              <KdsItemList items={bevItems} color="#2196F3" lang={lang} />
            )}
          </div>
        </div>

        {/* Panel 4: Waiter */}
        <div style={{ ...S.panel, borderColor: (hl === 'waiter' || hl === 'all') ? '#16A34A' : 'var(--border)' }}>
          <div style={{ ...S.panelHeader, background: (hl === 'waiter' || hl === 'all') ? '#16A34A' : 'var(--text-muted)' }}>
            {lang === 'zh' ? '服务员通知' : lang === 'ms' ? 'Notifikasi Pelayan' : 'Waiter Notification'}
          </div>
          <div style={S.panelBody}>
            {readyOrders.length === 0 ? (
              <div style={S.emptyPanel}>
                {lang === 'zh' ? '等待厨房完成...' : 'Waiting for kitchen...'}
              </div>
            ) : (
              readyOrders.map(o => (
                <div key={o.id} style={S.notifyCard}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>
                    Table {o.tableId} — {lang === 'zh' ? '可上菜' : 'Ready'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {o.items.map(i => i.name.split(' [')[0]).join(', ')}
                  </div>
                  <div style={S.serveBtnDemo}>
                    {lang === 'zh' ? '送出' : 'Serve'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Step indicator + controls */}
      <div style={S.stepBar}>
        <div style={S.stepProgress}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: 10, height: 10, borderRadius: 5,
              background: i === step ? '#FF6B2C' : i < step ? '#16A34A' : 'var(--border)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
        <div style={S.stepTitle}>{currentStep.title[lang] || currentStep.title.en}</div>
        <div style={S.stepDesc}>{currentStep.desc[lang] || currentStep.desc.en}</div>
        <div style={S.stepActions}>
          <button style={{ ...S.navBtn, opacity: canPrev ? 1 : 0.3 }} onClick={goPrev} disabled={!canPrev}>
            ← {lang === 'zh' ? '上一步' : 'Back'}
          </button>
          {canNext ? (
            <button style={S.nextBtn} onClick={goNext}>
              {lang === 'zh' ? '下一步' : 'Next'} →
            </button>
          ) : (
            <button style={S.nextBtn} onClick={reset}>
              {lang === 'zh' ? '重新播放' : 'Replay'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function KdsItemList({ items, color, lang }) {
  const grouped = {}
  items.forEach(i => {
    if (!grouped[i.tableId]) grouped[i.tableId] = []
    grouped[i.tableId].push(i)
  })

  return Object.entries(grouped).map(([tableId, its]) => {
    const allReady = its.every(i => i.kdsStatus === 'ready')
    return (
      <div key={tableId} style={{
        ...S.kdsCard,
        borderLeftColor: allReady ? '#16A34A' : color,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Table {tableId}</span>
          {allReady && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: '#DCFCE7', color: '#16A34A', fontWeight: 700 }}>
            {lang === 'zh' ? '已完成' : 'Done'}
          </span>}
        </div>
        {its.map(i => (
          <div key={i.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
            fontSize: 12, color: 'var(--text)',
            textDecoration: i.kdsStatus === 'ready' ? 'line-through' : 'none',
            opacity: i.kdsStatus === 'ready' ? 0.6 : 1,
          }}>
            <span>{i.kdsStatus === 'ready' ? '✅' : '⬜'}</span>
            <span>{i.qty}x {i.name.split(' [')[0]}</span>
          </div>
        ))}
      </div>
    )
  })
}

const S = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', background: 'var(--grad-header)',
    boxShadow: '0 4px 12px rgba(255,107,44,0.2)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)',
    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: 800, textAlign: 'center' },
  resetBtn: {
    background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.25)',
    padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
  },

  panelGrid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 10, padding: 10, overflow: 'auto',
    minHeight: 0,
  },
  panel: {
    borderRadius: 14, border: '3px solid',
    background: 'var(--bg-card)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    transition: 'border-color 0.3s',
    minHeight: 160,
  },
  panelHeader: {
    padding: '8px 12px', color: '#FFFFFF', fontSize: 13, fontWeight: 800,
    textAlign: 'center', transition: 'background 0.3s',
  },
  panelBody: { flex: 1, padding: 10, overflow: 'auto' },
  emptyPanel: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100%', color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic',
  },

  miniOrder: {
    background: 'var(--bg-lighter)', borderRadius: 10, padding: 10,
    marginBottom: 8, border: '1px solid var(--border)',
  },
  miniOrderHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6, fontSize: 13, color: 'var(--text)',
  },
  miniItem: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
  },

  kdsCard: {
    borderLeft: '4px solid', borderRadius: 8,
    padding: 10, marginBottom: 8,
    background: 'var(--bg-lighter)',
    transition: 'border-color 0.3s',
  },

  notifyCard: {
    background: '#DCFCE7', border: '2px solid #16A34A',
    borderRadius: 12, padding: 12, marginBottom: 8,
    animation: 'fadeIn 0.3s',
  },
  serveBtnDemo: {
    marginTop: 8, padding: '8px 16px', borderRadius: 8,
    background: '#16A34A', color: '#FFFFFF',
    fontSize: 13, fontWeight: 800, textAlign: 'center',
  },

  stepBar: {
    background: 'var(--bg-card)', borderTop: '2px solid var(--border)',
    padding: '12px 16px', flexShrink: 0,
  },
  stepProgress: {
    display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8,
  },
  stepTitle: {
    fontSize: 16, fontWeight: 800, color: 'var(--primary)',
    textAlign: 'center', marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13, color: 'var(--text-light)', textAlign: 'center',
    lineHeight: 1.5, marginBottom: 10, maxWidth: 600, margin: '0 auto 10px',
  },
  stepActions: {
    display: 'flex', gap: 10, justifyContent: 'center',
  },
  navBtn: {
    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600,
    background: 'var(--bg-lighter)', border: '1px solid var(--border)',
    color: 'var(--text)',
  },
  nextBtn: {
    padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 800,
    background: 'var(--grad-primary)', color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(255,107,44,0.3)',
  },
}
