// src/context/AppContext.jsx
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { translations } from '../i18n/translations'
import { getDefaultMenu } from '../data/menuData'
import DispatchService from '../services/DispatchService'

const AppContext = createContext(null)

export const TABLE_STATUS = {
  EMPTY: 'empty',
  OCCUPIED: 'occupied',
  PAID: 'paid',
  TAKEAWAY: 'takeaway',
}

const initialState = {
  language: 'zh',
  shopName: 'Warung365',
  storeId: '',
  taxRate: 0,
  tableCount: 20,
  tables: Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    status: TABLE_STATUS.EMPTY,
    orderIds: [],  // <-- changed from orderId to orderIds array
    paidAt: null,
  })),
  orders: {},
  completedOrders: [],
  menu: [],
  printerAddress: null,
  printerConnected: false,
  serverMode: 'main',
  serverIp: null,
  hostRunning: false,
  hostIp: null,
  joinJson: null,
  connectedClients: [],
  licenseKey: null,
  licenseType: null,
  licenseExpiry: null,
  trialStartDate: null,
  cookingMethodPrices: {
    dine_in: 0,
    takeaway: 0.5,
    extra: 1.0,
    extra_takeaway: 1.5,
  },
  deviceRole: 'cashier', // 'cashier' | 'waiter'
}

// Helper: recalculate table status based on its orderIds
function getTableStatus(table, orders) {
  const activeOrderIds = table.orderIds.filter(id => orders[id])
  if (activeOrderIds.length === 0) return TABLE_STATUS.EMPTY
  // If any order is takeaway type, show takeaway; otherwise occupied
  const hasTA = activeOrderIds.some(id => orders[id]?.type === 'takeaway')
  return hasTA && activeOrderIds.length === 1 ? TABLE_STATUS.TAKEAWAY : TABLE_STATUS.OCCUPIED
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload }

    case 'SET_LANGUAGE':
      return { ...state, language: action.payload }
    case 'SET_SHOP_NAME':
      return { ...state, shopName: action.payload }
    case 'SET_STORE_ID':
      return { ...state, storeId: action.payload }
    case 'SET_TAX_RATE':
      return { ...state, taxRate: action.payload }
    case 'SET_COOKING_PRICES':
      return { ...state, cookingMethodPrices: { ...state.cookingMethodPrices, ...action.payload } }
    case 'SET_DEVICE_ROLE':
      return { ...state, deviceRole: action.payload }

    case 'SET_TABLE_COUNT': {
      const newCount = action.payload
      const newTables = Array.from({ length: newCount }, (_, i) => {
        const existing = state.tables.find(t => t.id === i + 1)
        return existing || { id: i + 1, status: TABLE_STATUS.EMPTY, orderIds: [], paidAt: null }
      })
      return { ...state, tableCount: newCount, tables: newTables }
    }

    // ─── Menu management ───
    case 'SET_MENU':
      return { ...state, menu: action.payload }
    case 'ADD_CATEGORY':
      return { ...state, menu: [...state.menu, action.payload] }
    case 'UPDATE_CATEGORY':
      return { ...state, menu: state.menu.map(cat => cat.id === action.payload.id ? action.payload : cat) }
    case 'DELETE_CATEGORY':
      return { ...state, menu: state.menu.filter(cat => cat.id !== action.payload) }
    case 'ADD_ITEM': {
      const { categoryId, item } = action.payload
      return { ...state, menu: state.menu.map(cat => cat.id === categoryId ? { ...cat, items: [...cat.items, item] } : cat) }
    }
    case 'UPDATE_ITEM': {
      const { categoryId, item } = action.payload
      return { ...state, menu: state.menu.map(cat => cat.id === categoryId ? { ...cat, items: cat.items.map(i => i.id === item.id ? item : i) } : cat) }
    }
    case 'DELETE_ITEM': {
      const { categoryId, itemId } = action.payload
      return { ...state, menu: state.menu.map(cat => cat.id === categoryId ? { ...cat, items: cat.items.filter(i => i.id !== itemId) } : cat) }
    }
    case 'REORDER_CATEGORIES':
      return { ...state, menu: action.payload }

    // ─── Orders (multi-order per table) ───
    case 'CREATE_ORDER': {
      const { tableId, order } = action.payload
      const newOrders = { ...state.orders, [order.id]: order }
      const newTables = state.tables.map(t => {
        if (t.id !== tableId) return t
        const newOrderIds = [...t.orderIds, order.id]
        return {
          ...t,
          orderIds: newOrderIds,
          status: order.type === 'takeaway' && newOrderIds.length === 1
            ? TABLE_STATUS.TAKEAWAY
            : TABLE_STATUS.OCCUPIED,
        }
      })
      return { ...state, orders: newOrders, tables: newTables }
    }

    case 'UPDATE_ORDER': {
      const updatedOrder = action.payload
      return { ...state, orders: { ...state.orders, [updatedOrder.id]: updatedOrder } }
    }

    case 'ADD_ITEM_TO_ORDER': {
      const { orderId, item } = action.payload
      const order = state.orders[orderId]
      if (!order) return state
      return { ...state, orders: { ...state.orders, [orderId]: { ...order, items: [...order.items, item] } } }
    }

    case 'UPDATE_ITEM_QTY': {
      const { orderId, itemId, qty } = action.payload
      const order = state.orders[orderId]
      if (!order) return state
      const items = qty <= 0
        ? order.items.filter(i => i.id !== itemId)
        : order.items.map(i => i.id === itemId ? { ...i, qty } : i)
      return { ...state, orders: { ...state.orders, [orderId]: { ...order, items } } }
    }

    case 'REMOVE_ITEM': {
      const { orderId, itemId } = action.payload
      const order = state.orders[orderId]
      if (!order) return state
      return { ...state, orders: { ...state.orders, [orderId]: { ...order, items: order.items.filter(i => i.id !== itemId) } } }
    }

    case 'CANCEL_ORDER': {
      const { orderId, tableId } = action.payload
      const { [orderId]: _, ...remainingOrders } = state.orders
      const newTables = state.tables.map(t => {
        if (t.id !== tableId) return t
        const newOrderIds = t.orderIds.filter(id => id !== orderId)
        return {
          ...t,
          orderIds: newOrderIds,
          status: newOrderIds.length === 0 ? TABLE_STATUS.EMPTY : getTableStatus({ ...t, orderIds: newOrderIds }, remainingOrders),
        }
      })
      return { ...state, orders: remainingOrders, tables: newTables }
    }

    case 'CHECKOUT_ORDER': {
      const { orderId, tableId, payment } = action.payload
      const order = state.orders[orderId]
      if (!order) return state
      const completedOrder = { ...order, payment, completedAt: new Date().toISOString() }
      const { [orderId]: _, ...remainingOrders } = state.orders
      const newTables = state.tables.map(t => {
        if (t.id !== tableId) return t
        const newOrderIds = t.orderIds.filter(id => id !== orderId)
        if (newOrderIds.length === 0) {
          // Last order on this table → mark as paid
          return { ...t, orderIds: [], status: TABLE_STATUS.PAID, paidAt: Date.now() }
        }
        // Still has other orders → stay occupied
        return {
          ...t,
          orderIds: newOrderIds,
          status: getTableStatus({ ...t, orderIds: newOrderIds }, remainingOrders),
        }
      })
      return {
        ...state,
        orders: remainingOrders,
        tables: newTables,
        completedOrders: [...state.completedOrders, completedOrder],
      }
    }

    case 'REFUND_ORDER':
      return {
        ...state,
        completedOrders: state.completedOrders.map(o =>
          o.id === action.payload.completedOrderId
            ? { ...o, refunded: true, refundedAt: new Date().toISOString() }
            : o,
        ),
      }

    case 'UPDATE_ITEMS_KDS_STATUS': {
      const { orderId, itemIds, status } = action.payload
      const order = state.orders[orderId]
      if (!order) return state
      return {
        ...state,
        orders: {
          ...state.orders,
          [orderId]: {
            ...order,
            items: order.items.map(i => itemIds.includes(i.id) ? { ...i, kdsStatus: status } : i),
          },
        },
      }
    }

    case 'CLEAR_PAID_TABLE':
      return {
        ...state,
        tables: state.tables.map(t =>
          t.id === action.payload.tableId
            ? { ...t, status: TABLE_STATUS.EMPTY, orderIds: [], paidAt: null }
            : t,
        ),
      }

    case 'SET_PRINTER':
      return { ...state, printerAddress: action.payload.address, printerConnected: action.payload.connected }
    case 'SET_SERVER_MODE':
      return { ...state, serverMode: action.payload }
    case 'SET_SERVER_IP':
      return { ...state, serverIp: action.payload }
    case 'SET_HOST_RUNNING':
      return { ...state, hostRunning: action.payload }
    case 'SET_HOST_IP':
      return { ...state, hostIp: action.payload }
    case 'SET_JOIN_JSON':
      return { ...state, joinJson: action.payload }
    case 'SET_CONNECTED_CLIENTS':
      return { ...state, connectedClients: action.payload }

    case 'SET_LICENSE':
      return {
        ...state,
        licenseKey: action.payload.key,
        licenseType: action.payload.type,
        licenseExpiry: action.payload.expiry,
        trialStartDate: action.payload.trialStartDate || state.trialStartDate,
      }

    default:
      return state
  }
}

const STORAGE_KEY = 'pos_state_v3'

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const isWorker = state.serverMode === 'sub'
  // Prevent sync loops: when state change is from network, skip re-sending
  const syncFromNetwork = useRef(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Migrate old orderId → orderIds
        if (parsed.tables) {
          parsed.tables = parsed.tables.map(t => {
            if (t.orderId && !t.orderIds) {
              return { ...t, orderIds: [t.orderId], orderId: undefined }
            }
            if (!t.orderIds) t.orderIds = []
            return t
          })
        }
        // Runtime-only fields — never restore from disk (server doesn't survive restart)
        delete parsed.hostRunning
        delete parsed.hostIp
        delete parsed.joinJson
        delete parsed.connectedClients
        dispatch({ type: 'LOAD_STATE', payload: parsed })
        if (!parsed.menu || parsed.menu.length === 0) {
          dispatch({ type: 'SET_MENU', payload: getDefaultMenu() })
        }
        if (!parsed.licenseExpiry && !parsed.trialStartDate) {
          const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          dispatch({ type: 'SET_LICENSE', payload: { key: 'TRIAL', type: 'trial', expiry, trialStartDate: new Date().toISOString() } })
        }
      } else {
        dispatch({ type: 'SET_MENU', payload: getDefaultMenu() })
        const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        dispatch({ type: 'SET_LICENSE', payload: { key: 'TRIAL', type: 'trial', expiry, trialStartDate: new Date().toISOString() } })
      }
    } catch (e) { console.error('Load error', e) }
  }, [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (e) {}
  }, [state])

  // LAN sync: worker receives state from host
  useEffect(() => {
    if (!DispatchService.isNative) return
    if (!isWorker) return
    const handler = (nextState) => {
      if (!nextState || typeof nextState !== 'object') return
      syncFromNetwork.current = true
      dispatch({ type: 'LOAD_STATE', payload: nextState })
      setTimeout(() => { syncFromNetwork.current = false }, 500)
    }
    DispatchService.onState = handler
    return () => {
      if (DispatchService.onState === handler) DispatchService.onState = null
    }
  }, [isWorker])

  // LAN sync: worker sends orders+tables to host when they change
  useEffect(() => {
    if (!DispatchService.isNative) return
    if (!isWorker) return
    if (DispatchService.mode !== 'worker') return
    if (syncFromNetwork.current) return
    const id = setTimeout(() => {
      if (syncFromNetwork.current) return
      DispatchService.sendOrdersToHost(state.orders, state.tables).catch(() => {})
    }, 300)
    return () => clearTimeout(id)
  }, [state.orders, state.tables, isWorker])

  // LAN sync: host receives orders/tables from worker → merge → re-broadcast
  useEffect(() => {
    if (!DispatchService.isNative) return
    if (isWorker) return
    const handler = (orders, tables) => {
      syncFromNetwork.current = true
      dispatch({ type: 'LOAD_STATE', payload: { orders, tables } })
      setTimeout(() => { syncFromNetwork.current = false }, 500)
    }
    DispatchService.onWorkerOrders = handler
    return () => {
      if (DispatchService.onWorkerOrders === handler) DispatchService.onWorkerOrders = null
    }
  }, [isWorker])

  // LAN sync: host broadcasts state to workers when it changes (debounced).
  // Strip host-only / device-specific fields so workers don't overwrite their own role/mode.
  useEffect(() => {
    if (!DispatchService.isNative) return
    if (isWorker) return
    if (DispatchService.mode !== 'host') return
    if (syncFromNetwork.current) return
    const id = setTimeout(() => {
      if (syncFromNetwork.current) return
      const { serverMode, hostRunning, hostIp, joinJson, connectedClients, deviceRole, ...sharedState } = state
      DispatchService.broadcastState(sharedState).catch(() => {})
    }, 200)
    return () => clearTimeout(id)
  }, [state, isWorker])

  // Cross-tab sync: when another tab updates localStorage, reload state
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          dispatch({ type: 'LOAD_STATE', payload: parsed })
        } catch (_) {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  // Auto clear paid tables after 5s
  useEffect(() => {
    const timers = []
    state.tables.forEach(t => {
      if (t.status === TABLE_STATUS.PAID && t.paidAt) {
        const remaining = 5000 - (Date.now() - t.paidAt)
        if (remaining <= 0) {
          dispatch({ type: 'CLEAR_PAID_TABLE', payload: { tableId: t.id } })
        } else {
          timers.push(setTimeout(() => {
            dispatch({ type: 'CLEAR_PAID_TABLE', payload: { tableId: t.id } })
          }, remaining))
        }
      }
    })
    return () => timers.forEach(clearTimeout)
  }, [state.tables])

  const t = useCallback((key) => {
    return translations[state.language]?.[key] || translations.en?.[key] || key
  }, [state.language])

  const createOrder = useCallback((tableId, orderType = 'dine_in') => {
    const id = uuidv4()
    const order = { id, tableId, type: orderType, items: [], createdAt: new Date().toISOString() }
    dispatch({ type: 'CREATE_ORDER', payload: { tableId, order } })
    return id
  }, [])

  const getOrderTotal = useCallback((orderId) => {
    const order = state.orders[orderId]
    if (!order) return 0
    return order.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  }, [state.orders])

  const isLicenseValid = useCallback(() => {
    if (!state.licenseExpiry) return false
    return new Date(state.licenseExpiry) > new Date()
  }, [state.licenseExpiry])

  const getLicenseDaysLeft = useCallback(() => {
    if (!state.licenseExpiry) return 0
    const diff = new Date(state.licenseExpiry) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }, [state.licenseExpiry])

  // Helper: get all active orders for a table
  const getTableOrders = useCallback((tableId) => {
    const table = state.tables.find(t => t.id === tableId)
    if (!table) return []
    return table.orderIds.map(id => state.orders[id]).filter(Boolean)
  }, [state.tables, state.orders])

  // Helper: get total for all orders on a table
  const getTableTotal = useCallback((tableId) => {
    const orders = getTableOrders(tableId)
    return orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.qty, 0), 0)
  }, [getTableOrders])

  return (
    <AppContext.Provider value={{
      state, dispatch, t, createOrder, getOrderTotal,
      isLicenseValid, getLicenseDaysLeft, getTableOrders, getTableTotal,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
