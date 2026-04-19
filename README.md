# 🏪 POS 收银系统 — Web 版

**用 React + Vite 写的浏览器版 POS 系统。可以在 VSCode 直接运行，之后用 Capacitor 打包成 Android APK。**

---

## 🚀 立即运行（3 分钟）

### 1. 打开 VSCode 终端

打开 VSCode → 拖整个 `POSWeb` 文件夹进去 → 按 `` Ctrl + ` `` 打开终端

### 2. 安装依赖

```bash
npm install
```

等待 1-2 分钟安装所有库。

### 3. 启动

```bash
npm run dev
```

屏幕会显示：
```
VITE ready in 500 ms
➜  Local:   http://localhost:5173
```

**按住 `Ctrl` 点击 `http://localhost:5173`**，浏览器打开即可使用。

---

## 🧪 测试流程

### 试一下基本功能：

1. **开新单** → 点任意"空桌"（灰色格子）
2. **多层菜单** → 点"面食" → 云吞面 → 选面种 → 选干/汤 → 选堂食/打包
3. **加数量** → 进入订单详情，用 +/- 调整数量
4. **结账** → 点"💳 结账" → 用数字键盘输入收款金额 → 自动算找零
5. **查看桌号变化** → 付款后桌变青色，30秒后自动消失
6. **打包订单** → 长按空桌（电脑右键）或点右下"📦 打包"
7. **报表** → 右上角 📊 → 查看今天销售
8. **退款** → 报表里点"退款"
9. **设置** → 右上角 ⚙️ → 改店名、改语言、改做法价格
10. **License** → 设置 → 输入 `POS-DEMO-TEST-KEY1` → 激活月租

### 同步测试（先体验）：
- 在同一台电脑开两个浏览器标签 → 一个当主机，一个当副机
- 实际 APK 打包后才是真正同步

---

## 🌐 用手机测试

如果电脑和手机连同一个 WiFi：

1. 在终端看到 `Network: http://192.168.x.x:5173`
2. 手机浏览器输入这个地址
3. 就能在手机上用

---

## 📦 打包成 APK（之后再做）

当你在浏览器测试满意了，要打包成 APK 时：

```bash
# 1. 安装 Capacitor（只需一次）
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "POS System" "com.mypos.app"

# 2. 构建
npm run build
npx cap add android
npx cap sync

# 3. 打开 Android Studio 编译 APK
npx cap open android
```

到时候再详细讲打包步骤。**现在先专心测试功能。**

---

## 📁 项目文件夹结构

```
POSWeb/
├── package.json              ← 依赖列表
├── vite.config.js            ← Vite 配置
├── index.html                ← 入口 HTML
└── src/
    ├── main.jsx              ← React 入口
    ├── App.jsx               ← 主应用 + 路由
    ├── styles.css            ← 全局样式
    ├── context/
    │   └── AppContext.jsx    ← 全局状态（桌号/订单/设置）
    ├── data/
    │   └── menuData.js       ← 菜单数据（改菜单就这里）
    ├── i18n/
    │   └── translations.js   ← 三语翻译
    ├── services/
    │   ├── PrinterService.js ← 蓝牙打印
    │   ├── SyncService.js    ← WiFi 同步
    │   └── LicenseService.js ← 授权验证
    └── screens/
        ├── TableScreen.jsx   ← 桌号格子主页
        ├── MenuScreen.jsx    ← 点餐菜单
        ├── OrderScreen.jsx   ← 订单+收款键盘
        ├── ReportsScreen.jsx ← 报表
        ├── SettingsScreen.jsx← 设置
        └── SyncScreen.jsx    ← 设备同步
```

---

## ✏️ 常见修改

### 修改菜单
编辑 `src/data/menuData.js`，按现有格式加菜品

### 修改桌数
设置页面 → 桌号 → 输入数字 → 保存

### 修改做法加价
设置页面 → 价格调整（堂食/打包/加料/加料打包）

### 修改语言
右上角 ⚙️ 设置 → 选择 中文 / English / Melayu

### 加新翻译
编辑 `src/i18n/translations.js`

---

## 🎯 接下来

当你觉得功能满意了，告诉我：

1. 要加什么功能
2. 要怎么改界面
3. 准备好打包 APK 了

我会一步步带你做。现在 **先 `npm install` 再 `npm run dev` 体验一下**！

---

## ⚠️ 遇到问题？

**`npm install` 失败？**
- 确保 Node.js 版本 ≥ 18（终端输入 `node -v` 检查）

**端口 5173 被占用？**
- 修改 `vite.config.js` 里的 `port: 5173` 为别的数字

**按钮点不动/界面怪？**
- 确认用的是 Chrome 或 Edge 浏览器

**蓝牙打印机连不上？**
- 浏览器测试模式下是模拟的，打印内容在控制台（按 F12 看）
- 真实打印只能在 APK 里才生效
