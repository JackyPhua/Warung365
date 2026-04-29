import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'

/**
 * Warung365 menu workbook layout (sheets Categories, Items, Portions, Group1, Group2).
 * Edit in Excel, then Import from Excel in Menu Manager — keep sheet names & column headers.
 */

function nz(v) {
  return v === undefined || v === null ? '' : v
}

function num(v) {
  if (v === '' || v === undefined || v === null) return 0
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

/** @returns {Blob} */
export function menuToXlsxBlob(menu) {
  const categories = []
  const items = []
  const portions = []
  const group1 = []
  const group2 = []

  for (const cat of menu || []) {
    categories.push({
      category_id: nz(cat.id),
      name_zh: nz(cat.name?.zh),
      name_en: nz(cat.name?.en),
      name_ms: nz(cat.name?.ms),
      icon: nz(cat.icon),
      color: nz(cat.color),
      department: nz(cat.department) || 'food',
    })
    for (const it of cat.items || []) {
      const t = it.type || 'simple'
      items.push({
        category_id: nz(cat.id),
        item_id: nz(it.id),
        type: t,
        name_zh: nz(it.name?.zh),
        name_en: nz(it.name?.en),
        name_ms: nz(it.name?.ms),
        price: t === 'portion' ? '' : num(it.price),
        g1_zh: nz(it.group1Label?.zh),
        g1_en: nz(it.group1Label?.en),
        g2_zh: nz(it.group2Label?.zh),
        g2_en: nz(it.group2Label?.en),
      })
      if (t === 'portion') {
        for (const p of it.portions || []) {
          portions.push({
            item_id: nz(it.id),
            portion_id: nz(p.id),
            name_zh: nz(p.name?.zh),
            name_en: nz(p.name?.en),
            name_ms: nz(p.name?.ms),
            price: num(p.price),
          })
        }
      }
      if (t === 'multi') {
        for (const o of it.group1 || []) {
          group1.push({
            item_id: nz(it.id),
            option_id: nz(o.id),
            name_zh: nz(o.name?.zh),
            name_en: nz(o.name?.en),
            name_ms: nz(o.name?.ms),
            price: o.price != null && o.price !== '' ? num(o.price) : '',
          })
        }
        for (const o of it.group2 || []) {
          group2.push({
            item_id: nz(it.id),
            option_id: nz(o.id),
            name_zh: nz(o.name?.zh),
            name_en: nz(o.name?.en),
            name_ms: nz(o.name?.ms),
          })
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['Warung365 menu — edit in Excel, then Import Excel in app'],
    ['Sheets: Categories, Items, Portions (portion items), Group1 & Group2 (multi items)'],
    ['Items.type = simple | portion | multi'],
  ]), 'Readme')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(categories), 'Categories')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'Items')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(portions), 'Portions')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(group1), 'Group1')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(group2), 'Group2')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

function idOrNew(v) {
  const s = v != null ? String(v).trim() : ''
  if (s) return s
  return uuidv4()
}

/** @param {ArrayBuffer} arrayBuffer */
export function xlsxBlobToMenu(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const catsW = workbook.Sheets.Categories || workbook.Sheets.categories
  const itemsW = workbook.Sheets.Items || workbook.Sheets.items
  if (!catsW || !itemsW) {
    throw new Error('Missing "Categories" or "Items" sheet (need exact names).')
  }

  const norm = (row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      out[String(k).trim().toLowerCase().replace(/\s+/g, '_')] = v
    }
    return out
  }

  const catRows = XLSX.utils.sheet_to_json(catsW, { defval: '' }).map(norm)
  const itemRows = XLSX.utils.sheet_to_json(itemsW, { defval: '' }).map(norm)
  const portRows = (workbook.Sheets.Portions ? XLSX.utils.sheet_to_json(workbook.Sheets.Portions, { defval: '' }) : []).map(norm)
  const g1Rows = (workbook.Sheets.Group1 ? XLSX.utils.sheet_to_json(workbook.Sheets.Group1, { defval: '' }) : []).map(norm)
  const g2Rows = (workbook.Sheets.Group2 ? XLSX.utils.sheet_to_json(workbook.Sheets.Group2, { defval: '' }) : []).map(norm)

  const portByItem = {}
  for (const r of portRows) {
    const iid = String(r.item_id ?? r.itemid ?? '').trim()
    if (!iid) continue
    if (!portByItem[iid]) portByItem[iid] = []
    portByItem[iid].push({
      id: idOrNew(r.portion_id ?? r.portionid),
      name: {
        zh: String(r.name_zh ?? r.namezh ?? '').trim(),
        ...(String(r.name_en ?? r.nameen ?? '').trim() ? { en: String(r.name_en).trim() } : {}),
        ...(String(r.name_ms ?? r.namems ?? '').trim() ? { ms: String(r.name_ms).trim() } : {}),
      },
      price: num(r.price),
    })
  }

  const g1ByItem = {}
  for (const r of g1Rows) {
    const iid = String(r.item_id ?? r.itemid ?? '').trim()
    if (!iid) continue
    if (!g1ByItem[iid]) g1ByItem[iid] = []
    const entry = {
      id: idOrNew(r.option_id ?? r.optionid),
      name: {
        zh: String(r.name_zh ?? r.namezh ?? '').trim(),
        ...(String(r.name_en ?? r.nameen ?? '').trim() ? { en: String(r.name_en).trim() } : {}),
        ...(String(r.name_ms ?? r.namems ?? '').trim() ? { ms: String(r.name_ms).trim() } : {}),
      },
    }
    const pr = r.price
    if (pr !== '' && pr !== undefined && pr !== null) entry.price = num(pr)
    g1ByItem[iid].push(entry)
  }

  const g2ByItem = {}
  for (const r of g2Rows) {
    const iid = String(r.item_id ?? r.itemid ?? '').trim()
    if (!iid) continue
    if (!g2ByItem[iid]) g2ByItem[iid] = []
    g2ByItem[iid].push({
      id: idOrNew(r.option_id ?? r.optionid),
      name: {
        zh: String(r.name_zh ?? r.namezh ?? '').trim(),
        ...(String(r.name_en ?? r.nameen ?? '').trim() ? { en: String(r.name_en).trim() } : {}),
        ...(String(r.name_ms ?? r.namems ?? '').trim() ? { ms: String(r.name_ms).trim() } : {}),
      },
    })
  }

  const itemsByCat = {}
  for (const r of itemRows) {
    const cid = String(r.category_id ?? r.categoryid ?? '').trim()
    const typ = String(r.type ?? 'simple').trim().toLowerCase()
    if (!cid) continue
    if (!itemsByCat[cid]) itemsByCat[cid] = []

    const iid = idOrNew(r.item_id ?? r.itemid)
    const baseName = {
      zh: String(r.name_zh ?? r.namezh ?? '').trim(),
      ...(String(r.name_en ?? r.nameen ?? '').trim() ? { en: String(r.name_en).trim() } : {}),
      ...(String(r.name_ms ?? r.namems ?? '').trim() ? { ms: String(r.name_ms).trim() } : {}),
    }

    let item = { id: iid, type: typ === 'portion' ? 'portion' : typ === 'multi' ? 'multi' : 'simple', name: baseName }

    if (typ === 'simple') {
      item.price = num(r.price)
    } else if (typ === 'portion') {
      item.portions = portByItem[iid]?.length ? portByItem[iid] : [{ id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 0 }]
    } else if (typ === 'multi') {
      item.price = num(r.price)
      item.group1Label = {
        zh: String(r.g1_zh ?? r.g1zh ?? '选项 1').trim(),
        ...(String(r.g1_en ?? r.g1en ?? '').trim() ? { en: String(r.g1_en).trim() } : {}),
      }
      item.group2Label = {
        zh: String(r.g2_zh ?? r.g2zh ?? '选项 2').trim(),
        ...(String(r.g2_en ?? r.g2en ?? '').trim() ? { en: String(r.g2_en).trim() } : {}),
      }
      item.group1 = g1ByItem[iid]?.length ? g1ByItem[iid] : [{ id: uuidv4(), name: { zh: '' } }]
      item.group2 = g2ByItem[iid]?.length ? g2ByItem[iid] : [{ id: uuidv4(), name: { zh: '' } }]
    }

    itemsByCat[cid].push(item)
  }

  const menu = []
  for (const r of catRows) {
    const cid = idOrNew(r.category_id ?? r.categoryid)
    const zh = String(r.name_zh ?? r.namezh ?? '').trim()
    if (!zh && !String(r.name_en ?? r.nameen ?? '').trim()) continue
    menu.push({
      id: cid,
      name: {
        zh: zh || String(r.name_en ?? '').trim() || 'Category',
        ...(String(r.name_en ?? r.nameen ?? '').trim() ? { en: String(r.name_en).trim() } : {}),
        ...(String(r.name_ms ?? r.namems ?? '').trim() ? { ms: String(r.name_ms).trim() } : {}),
      },
      icon: String(r.icon ?? '🍜').trim() || '🍜',
      color: String(r.color ?? '#FF6B35').trim() || '#FF6B35',
      department: String(r.department ?? 'food').trim() === 'beverage' ? 'beverage' : 'food',
      items: itemsByCat[cid] || [],
    })
  }

  if (menu.length === 0) throw new Error('No valid rows in Categories sheet.')

  return menu
}
