import * as XLSX from 'xlsx'

/** @param {{ completedOrders?: any[], shopName?: string, storeId?: string }} state */
export function reportToXlsxBlob(state) {
  const orders = state.completedOrders || []
  const orderRows = orders.map((o) => {
    const d = new Date(o.completedAt)
    const total = (o.payment?.received || 0) - (o.payment?.change || 0)
    const items = o.items.map((i) => `${i.qty}x ${i.name}`).join('; ')
    return {
      date: d.toLocaleDateString('en-GB'),
      time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      order_id: o.id.substring(0, 8).toUpperCase(),
      table: o.tableId === 0 ? 'Takeaway' : `Table ${o.tableId}`,
      items,
      total_rm: Number(total.toFixed(2)),
      received_rm: Number((o.payment?.received || 0).toFixed(2)),
      change_rm: Number((o.payment?.change || 0).toFixed(2)),
      refunded: o.refunded ? 'Yes' : 'No',
    }
  })

  const totalSales = orders.reduce(
    (s, o) => s + ((o.payment?.received || 0) - (o.payment?.change || 0)),
    0,
  )
  const summary = [
    {
      shop: state.shopName || '',
      store_id: state.storeId || '',
      export_iso: new Date().toISOString(),
      order_count: orders.length,
      total_sales_rm: Number(totalSales.toFixed(2)),
    },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orderRows), 'Orders')

  const daily = {}
  for (const o of orders) {
    const d = new Date(o.completedAt)
    const key = d.toLocaleDateString('en-GB')
    const amt = (o.payment?.received || 0) - (o.payment?.change || 0)
    if (!daily[key]) daily[key] = { date: key, orders: 0, sales_rm: 0 }
    daily[key].orders++
    daily[key].sales_rm += amt
  }
  const dailyRows = Object.values(daily).map((row) => ({
    ...row,
    sales_rm: Number(row.sales_rm.toFixed(2)),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyRows), 'Daily')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
