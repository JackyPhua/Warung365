// src/data/menuData.js
import { v4 as uuidv4 } from 'uuid'

export const DEPARTMENTS = [
  { id: 'food', label: { zh: '食物部', en: 'Food', ms: 'Makanan' }, icon: '🍳', color: '#E53935' },
  { id: 'beverage', label: { zh: '饮料部', en: 'Beverage', ms: 'Minuman' }, icon: '🥤', color: '#2196F3' },
]

export const COOKING_METHODS = [
  { id: 'dine_in', key: 'dineIn', default: 0 },
  { id: 'takeaway', key: 'takeaway', default: 0.5 },
  { id: 'extra', key: 'extraIngredient', default: 1.0 },
  { id: 'extra_takeaway', key: 'extraTakeaway', default: 1.5 },
]

export const CATEGORY_ICONS = [
  '🍜', '🍚', '🥤', '🥨', '🍱', '🍞', '🥟', '🍛', '🍲', '🍡',
  '☕', '🧋', '🍹', '🧃', '🥧', '🍰', '🍪', '🍩', '🍔', '🌮',
  '🍕', '🍟', '🌭', '🥗', '🍣', '🍤', '🍥', '🍘', '🍢', '🍙',
  '🧇', '🥞', '🥓', '🍳', '🧆', '🥙', '🫔', '🍠', '🥠', '🥮',
]

export const CATEGORY_COLORS = [
  { id: 'orange', name: '橙', value: '#FF6B35' },
  { id: 'green',  name: '绿', value: '#4CAF50' },
  { id: 'blue',   name: '蓝', value: '#2196F3' },
  { id: 'amber',  name: '黄', value: '#FF9800' },
  { id: 'red',    name: '红', value: '#E53935' },
  { id: 'purple', name: '紫', value: '#9C27B0' },
  { id: 'teal',   name: '青', value: '#009688' },
  { id: 'pink',   name: '粉', value: '#E91E63' },
  { id: 'brown',  name: '棕', value: '#795548' },
  { id: 'indigo', name: '靛', value: '#3F51B5' },
]

export const ITEM_TYPES = [
  { id: 'simple',  label: '直接选',  desc: '一个价格' },
  { id: 'portion', label: '多份量',  desc: '小份/大份不同价' },
  { id: 'multi',   label: '多选项',  desc: '2 组子选项，组1可带价格' },
]

// name can be "string" or { zh, en, ms }
export function getLocalizedName(name, lang = 'zh') {
  if (!name) return ''
  if (typeof name === 'string') return name
  return name[lang] || name.zh || name.en || Object.values(name).filter(v => v)[0] || ''
}

export function getDefaultMenu() {
  return [
    // ═══ 面食 (multi: 面种 + 做法) ═══
    {
      id: uuidv4(),
      name: { zh: '面食', en: 'Noodles', ms: 'Mee' },
      icon: '🍜', color: '#FF6B35', department: 'food',
      items: [
        {
          id: uuidv4(), type: 'multi',
          name: { zh: '云吞面', en: 'Wanton Mee', ms: 'Mee Wantan' },
          price: 7.0,
          group1Label: { zh: '面种', en: 'Noodle Type', ms: 'Jenis Mee' },
          group1: [
            { id: uuidv4(), name: { zh: '幼面', en: 'Thin Noodle', ms: 'Mee Halus' } },
            { id: uuidv4(), name: { zh: '粗面', en: 'Thick Noodle', ms: 'Mee Kasar' } },
            { id: uuidv4(), name: { zh: '黄面', en: 'Yellow Noodle', ms: 'Mee Kuning' } },
            { id: uuidv4(), name: { zh: '米粉', en: 'Rice Noodle', ms: 'Bihun' } },
            { id: uuidv4(), name: { zh: '河粉', en: 'Flat Noodle', ms: 'Kuey Teow' } },
            { id: uuidv4(), name: { zh: '冬粉', en: 'Glass Noodle', ms: 'Tung Hoon' } },
          ],
          group2Label: { zh: '做法', en: 'Style', ms: 'Cara' },
          group2: [
            { id: uuidv4(), name: { zh: '干捞', en: 'Dry', ms: 'Kering' } },
            { id: uuidv4(), name: { zh: '汤', en: 'Soup', ms: 'Sup' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: '咖喱面', en: 'Curry Mee', ms: 'Mee Kari' },
          price: 8.0,
          group1Label: { zh: '面种', en: 'Noodle Type', ms: 'Jenis Mee' },
          group1: [
            { id: uuidv4(), name: { zh: '黄面', en: 'Yellow Noodle', ms: 'Mee Kuning' } },
            { id: uuidv4(), name: { zh: '米粉', en: 'Rice Noodle', ms: 'Bihun' } },
          ],
          group2Label: { zh: '做法', en: 'Style', ms: 'Cara' },
          group2: [
            { id: uuidv4(), name: { zh: '汤', en: 'Soup', ms: 'Sup' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: '板面', en: 'Pan Mee', ms: 'Pan Mee' },
          price: 8.5,
          group1Label: { zh: '面种', en: 'Noodle Type', ms: 'Jenis Mee' },
          group1: [
            { id: uuidv4(), name: { zh: '幼面', en: 'Thin', ms: 'Halus' } },
            { id: uuidv4(), name: { zh: '粗面', en: 'Thick', ms: 'Kasar' } },
          ],
          group2Label: { zh: '做法', en: 'Style', ms: 'Cara' },
          group2: [
            { id: uuidv4(), name: { zh: '干捞', en: 'Dry', ms: 'Kering' } },
            { id: uuidv4(), name: { zh: '汤', en: 'Soup', ms: 'Sup' } },
          ],
        },
      ],
    },

    // ═══ 饭类 (portion: 小份/大份) ═══
    {
      id: uuidv4(),
      name: { zh: '饭类', en: 'Rice', ms: 'Nasi' },
      icon: '🍚', color: '#4CAF50', department: 'food',
      items: [
        {
          id: uuidv4(), type: 'portion',
          name: { zh: '鸡饭', en: 'Chicken Rice', ms: 'Nasi Ayam' },
          portions: [
            { id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 7.0 },
            { id: uuidv4(), name: { zh: '大份', en: 'Large', ms: 'Besar' }, price: 9.0 },
          ],
        },
        {
          id: uuidv4(), type: 'portion',
          name: { zh: '咖喱饭', en: 'Curry Rice', ms: 'Nasi Kari' },
          portions: [
            { id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 7.5 },
            { id: uuidv4(), name: { zh: '大份', en: 'Large', ms: 'Besar' }, price: 9.5 },
          ],
        },
        {
          id: uuidv4(), type: 'portion',
          name: { zh: '炒饭', en: 'Fried Rice', ms: 'Nasi Goreng' },
          portions: [
            { id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 7.0 },
            { id: uuidv4(), name: { zh: '大份', en: 'Large', ms: 'Besar' }, price: 9.0 },
          ],
        },
        {
          id: uuidv4(), type: 'portion',
          name: { zh: '椰浆饭', en: 'Nasi Lemak', ms: 'Nasi Lemak' },
          portions: [
            { id: uuidv4(), name: { zh: '小份', en: 'Small', ms: 'Kecil' }, price: 6.0 },
            { id: uuidv4(), name: { zh: '大份', en: 'Large', ms: 'Besar' }, price: 8.5 },
          ],
        },
      ],
    },

    // ═══ 饮料 (multi: 温度带价格 + 甜度不影响价格) ═══
    {
      id: uuidv4(),
      name: { zh: '饮料', en: 'Drinks', ms: 'Minuman' },
      icon: '🥤', color: '#2196F3', department: 'beverage',
      items: [
        {
          id: uuidv4(), type: 'multi',
          name: { zh: 'Teh O', en: 'Teh O', ms: 'Teh O' },
          price: 1.80,
          group1Label: { zh: '温度', en: 'Temperature', ms: 'Suhu' },
          group1: [
            { id: uuidv4(), name: { zh: '热', en: 'Hot', ms: 'Panas' }, price: 1.80 },
            { id: uuidv4(), name: { zh: '冰', en: 'Iced', ms: 'Ais' }, price: 2.30 },
          ],
          group2Label: { zh: '甜度', en: 'Sugar Level', ms: 'Tahap Gula' },
          group2: [
            { id: uuidv4(), name: { zh: '正常甜', en: 'Normal', ms: 'Biasa' } },
            { id: uuidv4(), name: { zh: '少糖', en: 'Less Sugar', ms: 'Kurang Manis' } },
            { id: uuidv4(), name: { zh: '无糖', en: 'No Sugar', ms: 'Kosong' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: 'Teh Tarik', en: 'Teh Tarik', ms: 'Teh Tarik' },
          price: 2.00,
          group1Label: { zh: '温度', en: 'Temperature', ms: 'Suhu' },
          group1: [
            { id: uuidv4(), name: { zh: '热', en: 'Hot', ms: 'Panas' }, price: 2.00 },
            { id: uuidv4(), name: { zh: '冰', en: 'Iced', ms: 'Ais' }, price: 2.50 },
          ],
          group2Label: { zh: '甜度', en: 'Sugar Level', ms: 'Tahap Gula' },
          group2: [
            { id: uuidv4(), name: { zh: '正常甜', en: 'Normal', ms: 'Biasa' } },
            { id: uuidv4(), name: { zh: '少糖', en: 'Less Sugar', ms: 'Kurang Manis' } },
            { id: uuidv4(), name: { zh: '无糖', en: 'No Sugar', ms: 'Kosong' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: 'Kopi O', en: 'Kopi O', ms: 'Kopi O' },
          price: 1.80,
          group1Label: { zh: '温度', en: 'Temperature', ms: 'Suhu' },
          group1: [
            { id: uuidv4(), name: { zh: '热', en: 'Hot', ms: 'Panas' }, price: 1.80 },
            { id: uuidv4(), name: { zh: '冰', en: 'Iced', ms: 'Ais' }, price: 2.30 },
          ],
          group2Label: { zh: '甜度', en: 'Sugar Level', ms: 'Tahap Gula' },
          group2: [
            { id: uuidv4(), name: { zh: '正常甜', en: 'Normal', ms: 'Biasa' } },
            { id: uuidv4(), name: { zh: '少糖', en: 'Less Sugar', ms: 'Kurang Manis' } },
            { id: uuidv4(), name: { zh: '无糖', en: 'No Sugar', ms: 'Kosong' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: 'Kopi', en: 'Kopi', ms: 'Kopi' },
          price: 2.00,
          group1Label: { zh: '温度', en: 'Temperature', ms: 'Suhu' },
          group1: [
            { id: uuidv4(), name: { zh: '热', en: 'Hot', ms: 'Panas' }, price: 2.00 },
            { id: uuidv4(), name: { zh: '冰', en: 'Iced', ms: 'Ais' }, price: 2.50 },
          ],
          group2Label: { zh: '甜度', en: 'Sugar Level', ms: 'Tahap Gula' },
          group2: [
            { id: uuidv4(), name: { zh: '正常甜', en: 'Normal', ms: 'Biasa' } },
            { id: uuidv4(), name: { zh: '少糖', en: 'Less Sugar', ms: 'Kurang Manis' } },
            { id: uuidv4(), name: { zh: '无糖', en: 'No Sugar', ms: 'Kosong' } },
          ],
        },
        {
          id: uuidv4(), type: 'multi',
          name: { zh: 'Milo', en: 'Milo', ms: 'Milo' },
          price: 2.50,
          group1Label: { zh: '温度', en: 'Temperature', ms: 'Suhu' },
          group1: [
            { id: uuidv4(), name: { zh: '热', en: 'Hot', ms: 'Panas' }, price: 2.50 },
            { id: uuidv4(), name: { zh: '冰', en: 'Iced', ms: 'Ais' }, price: 3.00 },
          ],
          group2Label: { zh: '甜度', en: 'Sugar Level', ms: 'Tahap Gula' },
          group2: [
            { id: uuidv4(), name: { zh: '正常甜', en: 'Normal', ms: 'Biasa' } },
            { id: uuidv4(), name: { zh: '少糖', en: 'Less Sugar', ms: 'Kurang Manis' } },
            { id: uuidv4(), name: { zh: '无糖', en: 'No Sugar', ms: 'Kosong' } },
          ],
        },
        {
          id: uuidv4(), type: 'simple',
          name: { zh: '白开水', en: 'Water', ms: 'Air Kosong' },
          price: 0.50,
        },
      ],
    },

    // ═══ 小吃 (simple) ═══
    {
      id: uuidv4(),
      name: { zh: '小吃', en: 'Snacks', ms: 'Snek' },
      icon: '🥨', color: '#FF9800', department: 'food',
      items: [
        { id: uuidv4(), type: 'simple', name: { zh: '虾饼', en: 'Prawn Fritter', ms: 'Cucur Udang' }, price: 4.0 },
        { id: uuidv4(), type: 'simple', name: { zh: '薄饼', en: 'Popiah', ms: 'Popiah' }, price: 3.5 },
        { id: uuidv4(), type: 'simple', name: { zh: '鱼饼', en: 'Otak-Otak', ms: 'Otak-Otak' }, price: 4.5 },
        { id: uuidv4(), type: 'simple', name: { zh: '沙爹 (5串)', en: 'Satay (5pcs)', ms: 'Satay (5 cucuk)' }, price: 5.0 },
        { id: uuidv4(), type: 'simple', name: { zh: '沙爹 (10串)', en: 'Satay (10pcs)', ms: 'Satay (10 cucuk)' }, price: 9.0 },
      ],
    },
  ]
}
