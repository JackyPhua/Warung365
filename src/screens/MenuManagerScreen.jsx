// src/screens/MenuManagerScreen.jsx
import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useApp } from '../context/AppContext'
import {
  CATEGORY_ICONS, CATEGORY_COLORS, ITEM_TYPES, DEPARTMENTS,
  getLocalizedName, getDefaultMenu,
} from '../data/menuData'

// Inline translations for the manager screen itself
const MANAGER_T = {
  zh: {
    title: '菜单管理', back: '返回',
    addCategory: '新增大类', editCategory: '编辑类别', newCategory: '新增类别',
    deleteCategoryConfirm: '删除整个类别及所有菜品？',
    addItem: '加菜品', editItem: '编辑菜品', newItem: '新增菜品',
    deleteItemConfirm: '删除此菜品？',
    name: '名称', required: '*',
    icon: '图标', color: '颜色',
    type: '类型', price: '价格', basePrice: '基础价格',
    portionList: '份量列表', addPortion: '加份量',
    optionGroup1: '选项 1', optionGroup2: '选项 2',
    optionLabel: '标题', addOption: '加选项',
    multiLang: '多语言（可选）',
    cancel: '取消', save: '保存', close: '关闭',
    importExport: '导入/导出',
    importHint: '💡 复制 JSON 备份，或粘贴新菜单导入',
    copy: '复制', import: '导入',
    importConfirm: '导入将覆盖现有菜单，继续？',
    resetDefault: '恢复默认菜单',
    resetConfirm: '重置为默认菜单？当前修改将丢失',
    copied: '已复制', items: '项',
    placeholderName: '例: 面食', placeholderItem: '例: 云吞面',
    portionName: '份量名',
    department: '所属部门',
  },
  en: {
    title: 'Menu Manager', back: 'Back',
    addCategory: 'Add Category', editCategory: 'Edit Category', newCategory: 'New Category',
    deleteCategoryConfirm: 'Delete this category and all items?',
    addItem: 'Add Item', editItem: 'Edit Item', newItem: 'New Item',
    deleteItemConfirm: 'Delete this item?',
    name: 'Name', required: '*',
    icon: 'Icon', color: 'Color',
    type: 'Type', price: 'Price', basePrice: 'Base Price',
    portionList: 'Portions', addPortion: 'Add Portion',
    optionGroup1: 'Option 1', optionGroup2: 'Option 2',
    optionLabel: 'Label', addOption: 'Add Option',
    multiLang: 'Multi-language (optional)',
    cancel: 'Cancel', save: 'Save', close: 'Close',
    importExport: 'Import / Export',
    importHint: '💡 Copy JSON for backup, or paste to import',
    copy: 'Copy', import: 'Import',
    importConfirm: 'This will overwrite current menu. Continue?',
    resetDefault: 'Reset to Default',
    resetConfirm: 'Reset to default menu? All changes will be lost',
    copied: 'Copied', items: 'items',
    placeholderName: 'e.g. Noodles', placeholderItem: 'e.g. Wanton Mee',
    portionName: 'Portion name',
    department: 'Department',
  },
  ms: {
    title: 'Pengurus Menu', back: 'Kembali',
    addCategory: 'Tambah Kategori', editCategory: 'Edit Kategori', newCategory: 'Kategori Baru',
    deleteCategoryConfirm: 'Padam kategori ini dan semua item?',
    addItem: 'Tambah Item', editItem: 'Edit Item', newItem: 'Item Baru',
    deleteItemConfirm: 'Padam item ini?',
    name: 'Nama', required: '*',
    icon: 'Ikon', color: 'Warna',
    type: 'Jenis', price: 'Harga', basePrice: 'Harga Asas',
    portionList: 'Saiz', addPortion: 'Tambah Saiz',
    optionGroup1: 'Pilihan 1', optionGroup2: 'Pilihan 2',
    optionLabel: 'Label', addOption: 'Tambah Pilihan',
    multiLang: 'Pelbagai bahasa (pilihan)',
    cancel: 'Batal', save: 'Simpan', close: 'Tutup',
    importExport: 'Import / Eksport',
    importHint: '💡 Salin JSON untuk simpan, atau tampal untuk import',
    copy: 'Salin', import: 'Import',
    importConfirm: 'Ini akan menulis ganti menu semasa. Teruskan?',
    resetDefault: 'Tetap semula Default',
    resetConfirm: 'Tetap semula ke menu default? Semua perubahan akan hilang',
    copied: 'Disalin', items: 'item',
    placeholderName: 'cth: Mee', placeholderItem: 'cth: Mee Wantan',
    portionName: 'Nama saiz',
    department: 'Jabatan',
  },
}

export default function MenuManagerScreen({ onNavigate }) {
  const { state, dispatch } = useApp()
  const lang = state.language
  const mt = (key) => MANAGER_T[lang]?.[key] || MANAGER_T.en[key] || key

  const [editingCat, setEditingCat] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [showNewCat, setShowNewCat] = useState(false)
  const [showImportExport, setShowImportExport] = useState(false)

  const handleResetMenu = () => {
    if (confirm('⚠️ ' + mt('resetConfirm'))) {
      dispatch({ type: 'SET_MENU', payload: getDefaultMenu() })
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => onNavigate('settings')}>← {mt('back')}</button>
        <div style={styles.title}>📋 {mt('title')}</div>
        <button style={styles.iconBtn} onClick={() => setShowImportExport(true)}>⋮</button>
      </div>

      <div style={styles.scroll}>
        {state.menu.map(cat => (
          <CategoryBlock
            key={cat.id}
            category={cat}
            lang={lang}
            mt={mt}
            onEditCategory={() => setEditingCat(cat)}
            onDeleteCategory={() => {
              if (confirm(mt('deleteCategoryConfirm') + `\n「${getLocalizedName(cat.name, lang)}」`)) {
                dispatch({ type: 'DELETE_CATEGORY', payload: cat.id })
              }
            }}
            onAddItem={() => setEditingItem({ categoryId: cat.id, item: null })}
            onEditItem={(item) => setEditingItem({ categoryId: cat.id, item })}
            onDeleteItem={(itemId) => {
              if (confirm(mt('deleteItemConfirm'))) {
                dispatch({ type: 'DELETE_ITEM', payload: { categoryId: cat.id, itemId } })
              }
            }}
          />
        ))}

        <button style={styles.addCatBtn} onClick={() => setShowNewCat(true)}>
          ➕ {mt('addCategory')}
        </button>

        <button style={styles.resetBtn} onClick={handleResetMenu}>
          ⟲ {mt('resetDefault')}
        </button>
      </div>

      {editingCat && (
        <CategoryEditor
          category={editingCat}
          lang={lang}
          mt={mt}
          onSave={(cat) => { dispatch({ type: 'UPDATE_CATEGORY', payload: cat }); setEditingCat(null) }}
          onClose={() => setEditingCat(null)}
        />
      )}

      {showNewCat && (
        <CategoryEditor
          category={null}
          lang={lang}
          mt={mt}
          onSave={(cat) => { dispatch({ type: 'ADD_CATEGORY', payload: cat }); setShowNewCat(false) }}
          onClose={() => setShowNewCat(false)}
        />
      )}

      {editingItem && (
        <ItemEditor
          item={editingItem.item}
          lang={lang}
          mt={mt}
          onSave={(item) => {
            if (editingItem.item) {
              dispatch({ type: 'UPDATE_ITEM', payload: { categoryId: editingItem.categoryId, item } })
            } else {
              dispatch({ type: 'ADD_ITEM', payload: { categoryId: editingItem.categoryId, item } })
            }
            setEditingItem(null)
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {showImportExport && (
        <ImportExport
          menu={state.menu}
          mt={mt}
          onImport={(menu) => { dispatch({ type: 'SET_MENU', payload: menu }); setShowImportExport(false) }}
          onClose={() => setShowImportExport(false)}
        />
      )}
    </div>
  )
}

function CategoryBlock({ category, lang, mt, onEditCategory, onDeleteCategory, onAddItem, onEditItem, onDeleteItem }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{ ...styles.catBlock, borderLeft: `4px solid ${category.color}` }}>
      <div style={styles.catHeader}>
        <button style={styles.catToggle} onClick={() => setExpanded(!expanded)}>
          <span style={{ fontSize: 22, marginRight: 10 }}>{category.icon}</span>
          <span style={{ color: category.color, fontSize: 15, fontWeight: 700, flex: 1, textAlign: 'left' }}>
            {getLocalizedName(category.name, lang)}
          </span>
          <span style={{ color: 'var(--text-light)', fontSize: 12 }}>({category.items.length} {mt('items')})</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{expanded ? '▼' : '▶'}</span>
        </button>
        <button style={styles.smallBtn} onClick={onEditCategory}>✏️</button>
        <button style={styles.smallBtn} onClick={onDeleteCategory}>🗑️</button>
      </div>

      {expanded && (
        <>
          {category.items.map(item => (
            <div key={item.id} style={styles.itemRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
                  {getLocalizedName(item.name, lang)}
                </div>
                <div style={{ color: 'var(--text-light)', fontSize: 11, marginTop: 3 }}>
                  {item.type === 'simple' && `RM ${item.price?.toFixed(2)}`}
                  {item.type === 'portion' && `${item.portions?.length || 0} ${mt('portionList')}`}
                  {item.type === 'multi' && `${item.group1?.length}·${item.group2?.length} · RM ${item.price?.toFixed(2)}`}
                </div>
              </div>
              <button style={styles.smallBtn} onClick={() => onEditItem(item)}>✏️</button>
              <button style={styles.smallBtn} onClick={() => onDeleteItem(item.id)}>🗑️</button>
            </div>
          ))}
          <button style={styles.addItemBtn} onClick={onAddItem}>+ {mt('addItem')}</button>
        </>
      )}
    </div>
  )
}

function CategoryEditor({ category, lang, mt, onSave, onClose }) {
  const [nameZh, setNameZh] = useState(category?.name?.zh || '')
  const [nameEn, setNameEn] = useState(category?.name?.en || '')
  const [nameMs, setNameMs] = useState(category?.name?.ms || '')
  const [icon, setIcon] = useState(category?.icon || '🍜')
  const [color, setColor] = useState(category?.color || '#FF6B35')
  const [department, setDepartment] = useState(category?.department || 'food')
  const [showAllLangs, setShowAllLangs] = useState(!!(category?.name?.en || category?.name?.ms))

  const handleSave = () => {
    if (!nameZh.trim()) { alert(mt('name') + ' ' + mt('required')); return }
    const name = { zh: nameZh.trim() }
    if (nameEn.trim()) name.en = nameEn.trim()
    if (nameMs.trim()) name.ms = nameMs.trim()
    onSave({
      id: category?.id || uuidv4(),
      name, icon, color, department,
      items: category?.items || [],
    })
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={styles.modalTitle}>{category ? mt('editCategory') : mt('newCategory')}</h3>

      <label style={styles.label}>{mt('name')} <span style={{ color: 'var(--danger)' }}>{mt('required')}</span></label>
      <input style={styles.input} value={nameZh} onChange={e => setNameZh(e.target.value)} placeholder={mt('placeholderName')} />

      <button
        style={{ ...styles.toggleLangBtn, color: showAllLangs ? 'var(--primary-dark)' : 'var(--text-light)' }}
        onClick={() => setShowAllLangs(!showAllLangs)}
      >
        {showAllLangs ? '▼' : '▶'} {mt('multiLang')}
      </button>

      {showAllLangs && (
        <>
          <label style={styles.label}>English</label>
          <input style={styles.input} value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Noodles" />
          <label style={styles.label}>Melayu</label>
          <input style={styles.input} value={nameMs} onChange={e => setNameMs(e.target.value)} placeholder="cth: Mee" />
        </>
      )}

      <label style={styles.label}>{mt('icon')}</label>
      <div style={styles.iconGrid}>
        {CATEGORY_ICONS.map(ic => (
          <button
            key={ic}
            style={{
              ...styles.iconOption,
              background: icon === ic ? 'var(--primary-light)' : 'var(--bg)',
              border: icon === ic ? '2px solid var(--primary)' : '1px solid var(--border)',
            }}
            onClick={() => setIcon(ic)}
          >
            {ic}
          </button>
        ))}
      </div>

      <label style={styles.label}>{mt('color')}</label>
      <div style={styles.colorRow}>
        {CATEGORY_COLORS.map(c => (
          <button
            key={c.id}
            style={{
              ...styles.colorOption,
              background: c.value,
              border: color === c.value ? '3px solid var(--text)' : '2px solid transparent',
              boxShadow: color === c.value ? `0 4px 12px ${c.value}66` : 'none',
            }}
            onClick={() => setColor(c.value)}
            title={c.name}
          />
        ))}
      </div>

      <label style={styles.label}>{mt('department')}</label>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {DEPARTMENTS.map(d => (
          <button
            key={d.id}
            style={{
              flex: 1, padding: 12, borderRadius: 10, textAlign: 'center',
              border: '2px solid',
              background: department === d.id ? d.color : 'var(--bg)',
              color: department === d.id ? '#FFFFFF' : 'var(--text)',
              borderColor: department === d.id ? d.color : 'var(--border)',
              fontWeight: 700, fontSize: 14,
            }}
            onClick={() => setDepartment(d.id)}
          >
            {d.icon} {getLocalizedName(d.label, lang)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={styles.cancelBtn} onClick={onClose}>{mt('cancel')}</button>
        <button style={styles.saveBtn} onClick={handleSave}>{mt('save')}</button>
      </div>
    </Modal>
  )
}

function ItemEditor({ item, lang, mt, onSave, onClose }) {
  const [nameZh, setNameZh] = useState(item?.name?.zh || '')
  const [nameEn, setNameEn] = useState(item?.name?.en || '')
  const [nameMs, setNameMs] = useState(item?.name?.ms || '')
  const [showAllLangs, setShowAllLangs] = useState(!!(item?.name?.en || item?.name?.ms))
  const [type, setType] = useState(item?.type || 'simple')
  const [price, setPrice] = useState(item?.price || 0)
  const [portions, setPortions] = useState(item?.portions || [
    { id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 5.0 },
    { id: uuidv4(), name: { zh: '大份', en: 'Large', ms: 'Besar' }, price: 7.0 },
  ])
  const [group1Label, setGroup1Label] = useState(item?.group1Label?.zh || mt('optionGroup1'))
  const [group1, setGroup1] = useState(item?.group1 || [{ id: uuidv4(), name: { zh: '' } }])
  const [group2Label, setGroup2Label] = useState(item?.group2Label?.zh || mt('optionGroup2'))
  const [group2, setGroup2] = useState(item?.group2 || [{ id: uuidv4(), name: { zh: '' } }])

  const handleSave = () => {
    if (!nameZh.trim()) { alert(mt('name') + ' ' + mt('required')); return }
    const name = { zh: nameZh.trim() }
    if (nameEn.trim()) name.en = nameEn.trim()
    if (nameMs.trim()) name.ms = nameMs.trim()

    let saved = { id: item?.id || uuidv4(), type, name }

    if (type === 'simple') {
      saved.price = parseFloat(price) || 0
    } else if (type === 'portion') {
      if (portions.length === 0) { alert(mt('portionList')); return }
      saved.portions = portions.map(p => ({
        id: p.id,
        name: { zh: p.name?.zh || '' },
        price: parseFloat(p.price) || 0,
      }))
    } else if (type === 'multi') {
      if (group1.length === 0 || group2.length === 0) { alert(mt('optionGroup1') + '/' + mt('optionGroup2')); return }
      saved.price = parseFloat(price) || 0
      saved.group1Label = { zh: group1Label }
      saved.group1 = group1.map(g => {
        const entry = { id: g.id, name: { zh: g.name?.zh || '' } }
        if (g.price != null && g.price !== '') entry.price = parseFloat(g.price) || 0
        return entry
      })
      saved.group2Label = { zh: group2Label }
      saved.group2 = group2.map(g => ({ id: g.id, name: { zh: g.name?.zh || '' } }))
    }

    onSave(saved)
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={styles.modalTitle}>{item ? mt('editItem') : mt('newItem')}</h3>

      <label style={styles.label}>{mt('name')} <span style={{ color: 'var(--danger)' }}>{mt('required')}</span></label>
      <input style={styles.input} value={nameZh} onChange={e => setNameZh(e.target.value)} placeholder={mt('placeholderItem')} />

      <button
        style={{ ...styles.toggleLangBtn, color: showAllLangs ? 'var(--primary-dark)' : 'var(--text-light)' }}
        onClick={() => setShowAllLangs(!showAllLangs)}
      >
        {showAllLangs ? '▼' : '▶'} {mt('multiLang')}
      </button>

      {showAllLangs && (
        <>
          <label style={styles.label}>English</label>
          <input style={styles.input} value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Wanton Mee" />
          <label style={styles.label}>Melayu</label>
          <input style={styles.input} value={nameMs} onChange={e => setNameMs(e.target.value)} placeholder="cth: Mee Wantan" />
        </>
      )}

      <label style={styles.label}>{mt('type')}</label>
      <div style={styles.typeRow}>
        {ITEM_TYPES.map(tt => (
          <button
            key={tt.id}
            style={{
              ...styles.typeBtn,
              background: type === tt.id ? 'var(--grad-primary)' : 'var(--bg)',
              color: type === tt.id ? '#FFFFFF' : 'var(--text)',
              borderColor: type === tt.id ? 'var(--accent)' : 'var(--border)',
            }}
            onClick={() => setType(tt.id)}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{tt.label}</div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 3 }}>{tt.desc}</div>
          </button>
        ))}
      </div>

      {type === 'simple' && (
        <>
          <label style={styles.label}>{mt('price')} (RM)</label>
          <input
            style={styles.input} type="number" step="0.1"
            value={price} onChange={e => setPrice(e.target.value)}
          />
        </>
      )}

      {type === 'portion' && (
        <>
          <label style={styles.label}>{mt('portionList')}</label>
          {portions.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                style={{ ...styles.input, flex: 1, margin: 0 }}
                value={p.name?.zh || ''}
                onChange={e => {
                  const next = [...portions]
                  next[i] = { ...p, name: { zh: e.target.value } }
                  setPortions(next)
                }}
                placeholder={mt('portionName')}
              />
              <input
                style={{ ...styles.input, width: 80, margin: 0 }}
                type="number" step="0.1"
                value={p.price}
                onChange={e => {
                  const next = [...portions]
                  next[i] = { ...p, price: parseFloat(e.target.value) || 0 }
                  setPortions(next)
                }}
                placeholder="RM"
              />
              <button
                style={styles.smallDelBtn}
                onClick={() => setPortions(portions.filter((_, idx) => idx !== i))}
              >✕</button>
            </div>
          ))}
          <button
            style={styles.addRowBtn}
            onClick={() => setPortions([...portions, { id: uuidv4(), name: { zh: '' }, price: 0 }])}
          >+ {mt('addPortion')}</button>
        </>
      )}

      {type === 'multi' && (
        <>
          <label style={styles.label}>{mt('basePrice')} (RM)</label>
          <input
            style={styles.input} type="number" step="0.1"
            value={price} onChange={e => setPrice(e.target.value)}
          />

          <label style={styles.label}>{mt('optionGroup1')} · {mt('optionLabel')} ({mt('price')})</label>
          <input style={styles.input} value={group1Label} onChange={e => setGroup1Label(e.target.value)} />
          {group1.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                style={{ ...styles.input, flex: 1, margin: 0 }}
                value={g.name?.zh || ''}
                onChange={e => {
                  const next = [...group1]
                  next[i] = { ...g, name: { zh: e.target.value } }
                  setGroup1(next)
                }}
                placeholder={mt('name')}
              />
              <input
                style={{ ...styles.input, width: 80, margin: 0 }}
                type="number" step="0.1"
                value={g.price ?? ''}
                onChange={e => {
                  const next = [...group1]
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value) || 0
                  next[i] = { ...g, price: val }
                  setGroup1(next)
                }}
                placeholder="RM"
              />
              <button
                style={styles.smallDelBtn}
                onClick={() => setGroup1(group1.filter((_, idx) => idx !== i))}
              >✕</button>
            </div>
          ))}
          <button
            style={styles.addRowBtn}
            onClick={() => setGroup1([...group1, { id: uuidv4(), name: { zh: '' } }])}
          >+ {mt('addOption')}</button>

          <label style={styles.label}>{mt('optionGroup2')} · {mt('optionLabel')}</label>
          <input style={styles.input} value={group2Label} onChange={e => setGroup2Label(e.target.value)} />
          {group2.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                style={{ ...styles.input, flex: 1, margin: 0 }}
                value={g.name?.zh || ''}
                onChange={e => {
                  const next = [...group2]
                  next[i] = { ...g, name: { zh: e.target.value } }
                  setGroup2(next)
                }}
              />
              <button
                style={styles.smallDelBtn}
                onClick={() => setGroup2(group2.filter((_, idx) => idx !== i))}
              >✕</button>
            </div>
          ))}
          <button
            style={styles.addRowBtn}
            onClick={() => setGroup2([...group2, { id: uuidv4(), name: { zh: '' } }])}
          >+ {mt('addOption')}</button>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button style={styles.cancelBtn} onClick={onClose}>{mt('cancel')}</button>
        <button style={styles.saveBtn} onClick={handleSave}>{mt('save')}</button>
      </div>
    </Modal>
  )
}

function ImportExport({ menu, mt, onImport, onClose }) {
  const [jsonText, setJsonText] = useState(JSON.stringify(menu, null, 2))

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonText)
      if (!Array.isArray(parsed)) { alert('Format error'); return }
      if (confirm(mt('importConfirm'))) onImport(parsed)
    } catch (e) {
      alert('JSON error: ' + e.message)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText).then(() => alert('✅ ' + mt('copied')))
  }

  return (
    <Modal onClose={onClose}>
      <h3 style={styles.modalTitle}>{mt('importExport')}</h3>
      <div style={{ color: 'var(--text-light)', fontSize: 12, marginBottom: 10 }}>
        {mt('importHint')}
      </div>
      <textarea
        style={{
          ...styles.input, height: 250, fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre',
        }}
        value={jsonText}
        onChange={e => setJsonText(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button style={styles.cancelBtn} onClick={onClose}>{mt('close')}</button>
        <button style={styles.flexBtn} onClick={handleCopy}>📋 {mt('copy')}</button>
        <button style={styles.saveBtn} onClick={handleImport}>📥 {mt('import')}</button>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(44,62,80,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100, animation: 'fadeIn 0.2s',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 520,
          background: '#FFFFFF',
          borderRadius: '20px 20px 0 0',
          padding: 22, maxHeight: '90vh', overflow: 'auto',
          animation: 'slideUp 0.3s',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', background: 'var(--bg-card)',
    borderBottom: '1px solid var(--border)',
  },
  backBtn: {
    background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 500,
  },
  iconBtn: {
    background: 'var(--bg)', color: 'var(--text)',
    border: '1px solid var(--border)',
    padding: '8px 14px', borderRadius: 10, fontSize: 18,
  },
  title: { color: 'var(--text)', fontSize: 16, fontWeight: 700 },
  scroll: { flex: 1, overflow: 'auto', padding: 14 },
  catBlock: {
    background: 'var(--bg-card)', borderRadius: 14,
    padding: 14, marginBottom: 12,
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-sm)',
  },
  catHeader: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 },
  catToggle: {
    flex: 1, display: 'flex', alignItems: 'center',
    background: 'transparent', color: 'var(--text)', padding: 8,
  },
  smallBtn: {
    background: 'var(--bg)', border: '1px solid var(--border)',
    padding: '6px 10px', borderRadius: 8, fontSize: 13,
  },
  smallDelBtn: {
    background: 'var(--danger-light)', color: 'var(--danger)',
    padding: '8px 12px', borderRadius: 8, fontSize: 14,
    border: '1px solid var(--danger)',
  },
  itemRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'var(--bg)', borderRadius: 10,
    padding: 10, marginBottom: 6,
  },
  addItemBtn: {
    width: '100%', padding: 10, marginTop: 4,
    background: 'var(--primary-light)', border: '1px dashed var(--primary)',
    borderRadius: 10, color: 'var(--primary-dark)', fontSize: 13, fontWeight: 600,
  },
  addCatBtn: {
    width: '100%', padding: 14, marginTop: 4,
    background: 'var(--grad-primary)',
    color: '#FFFFFF', borderRadius: 12, fontSize: 15, fontWeight: 700,
    boxShadow: 'var(--shadow-purple)',
  },
  resetBtn: {
    width: '100%', padding: 10, marginTop: 10,
    background: 'transparent', color: 'var(--text-light)',
    borderRadius: 10, fontSize: 12,
  },
  modalTitle: { color: 'var(--text)', fontSize: 18, margin: '0 0 16px', textAlign: 'center', fontWeight: 700 },
  label: { display: 'block', color: 'var(--text-light)', fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    width: '100%', background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 12px', fontSize: 14,
    boxSizing: 'border-box', color: 'var(--text)',
    marginBottom: 2,
  },
  toggleLangBtn: {
    background: 'transparent', padding: '8px 0', fontSize: 12,
    marginTop: 10, textAlign: 'left', width: '100%', fontWeight: 600,
  },
  iconGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
    gap: 6, marginTop: 4,
  },
  iconOption: { padding: 10, borderRadius: 8, fontSize: 22 },
  colorRow: { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorOption: { width: 38, height: 38, borderRadius: 19 },
  typeRow: { display: 'flex', gap: 8, marginTop: 4 },
  typeBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    textAlign: 'center', border: '1px solid',
  },
  addRowBtn: {
    width: '100%', padding: 8, marginTop: 4,
    background: 'var(--primary-light)', border: '1px dashed var(--primary)',
    borderRadius: 8, color: 'var(--primary-dark)', fontSize: 12, fontWeight: 600,
  },
  cancelBtn: {
    flex: 1, padding: 13, background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 10, fontSize: 14, fontWeight: 600,
  },
  saveBtn: {
    flex: 2, padding: 13,
    background: 'var(--grad-gold)',
    color: 'var(--primary-dark)', borderRadius: 10, fontSize: 14, fontWeight: 800,
    boxShadow: 'var(--shadow-gold)',
  },
  flexBtn: {
    flex: 1, padding: 13, background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--accent)', borderRadius: 10, fontSize: 13, fontWeight: 600,
  },
}
