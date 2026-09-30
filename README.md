# 🐿️ 松鼠Pad (Squirrel Pad) - 实时协同代码编辑器 & 桌面主被控监控套件

一个专注于**多人实时协同编辑 + 语法高亮**的轻量级开箱即用代码协作平台，以及配套的 **macOS 主控端 App（房主/面试官控制台）** 与 **macOS 桌面伴侣被控端（防截屏/悬浮穿透/定时及即时截屏）**。

---

## 📥 官方桌面安装包下载 (GitHub Release v1.0.0)

| 平台架构 | 推荐安装格式 | 便携格式 / 备用 | 兼容性说明 |
| :--- | :--- | :--- | :--- |
| **macOS Apple Silicon** | [🍏 SongshuPad-macOS-arm64.dmg](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-macOS-arm64.dmg) | [SongshuPad-macOS-arm64.zip](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-macOS-arm64.zip) | 适用于 M1 / M2 / M3 / M4 芯片 Mac |
| **macOS Intel** | [🍏 SongshuPad-macOS-x64.dmg](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-macOS-x64.dmg) | [SongshuPad-macOS-x64.zip](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-macOS-x64.zip) | 适用于 Intel 处理器 Mac |
| **Windows 64位** | [🪟 SongshuPad-Windows-Portable.exe](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-Windows-Portable.exe) | [SongshuPad-Windows-x64.zip](https://github.com/redfoxpum/songshu_pad/releases/download/v1.0.0/SongshuPad-Windows-x64.zip) | 单文件绿色便携免安装，双击直接运行 |

> 📌 **快捷键防冲突说明**：为彻底避免 macOS 系统级冲突（如系统原生占用 `Cmd+H` 隐藏应用、`Cmd+X` 剪切文本），桌面端现已全面升级支持 **`Cmd + Shift + ...`**（Windows 为 `Ctrl + Shift + ...`）双修饰键组合，同时也保留原单键快捷键，双通道均可触发。

---

## 🌟 核心功能一览

### 1. 协作平台核心 (Web & Server)
- **CRDT 实时协同 (Yjs)**：毫秒级多端文本同步，数学保证并发无冲突。
- **协同光标感知 (Awareness)**：实时彩色光标与浮动名字标签。
- **多语言语法高亮**：Python 3、C++ 20、Java 21 模版开箱即用。
- **房间隔离持久化**：每个房间拥有独立数据与截图归档目录 `./data/rooms/<roomId>/`。

### 2. 🖥️ macOS 主控端 App (`server-app`)
- **一键运行与公网穿透**：双击启动本地服务，自动运行 `cloudflared` 隧道并捕获提取公网 URL、二维码一键分享。
- **房间创建与管理**：可视化创建新房间（如“张三-算法面试”），隔离生成该房间专属截图目录。
- **在 Finder 中直达**：一键点击 `[在 Finder 中打开]` 弹出对应房间的本地截图文件夹。
- **实时监控与在线卡片**：查看被控端设备名、延迟与屏幕录制权限健康状态（✅/⚠️）。
- **⚡ On-Demand 即时截屏**：房主点击 `[📸 立即抓取屏幕]`，秒级触发被控端全屏截图并弹出高清大图。
- **⏰ 30s 截图画廊**：时间轴倒序展示历史截图，区分定时与即时徽标，支持全屏大图查看器与键盘翻页。

### 3. 🕵️ 多端桌面伴侣被控端 (`desktop-agent`)
- **跨平台原生支持**：全面支持 **Windows (x64)**、**macOS Intel (x64)** 与 **macOS Apple Silicon (arm64)**。
- **任务栏无痕隐形 (Skip Taskbar)**：开启 `skipTaskbar: true`，在 Windows 任务栏中**完全不显示应用图标与运行栏**，杜绝屏幕分享/远程投屏时任务栏露馅。
- **屏幕分享隐形防抓取**：启用 `setContentProtection(true)`，在 Zoom / Teams / 腾讯会议 / OBS / 系统录屏中**完全隐形（透明背景）**。
- **高级悬浮置顶**：`alwaysOnTop: 'screen-saver'`，全屏与多桌面漫游置顶。
- **点击穿透 (Click-Through)**：支持全局快捷键（macOS 为 `Cmd+Shift+X` 或 `Cmd+X`，Windows 为 `Ctrl+Shift+X` 或 `Ctrl+X`）随时切换鼠标穿透。
- **全屏完全隐藏/显示 (Boss Key)**：全局快捷键 `Cmd+Shift+H` 或 `Cmd+H`（Windows 为 `Ctrl+Shift+H` 或 `Ctrl+H`）一键完全隐藏窗口，再按一次即刻显示。
- **代码 / 白板模式切换**：全局快捷键 `Cmd+Shift+B` 或 `Cmd+B`（Windows 为 `Ctrl+Shift+B` 或 `Ctrl+B`）一键在协同代码与协同画图白板间切换。
- **底板透明度快捷调节**：全局快捷键 `Cmd+Shift+[` / `Cmd+[` 降低底板透明度，`Cmd+Shift+]` / `Cmd+]` 增加底板透明度。
- **窗口高度快捷调节**：全局快捷键 `Cmd+Shift+=` / `Cmd+=` 增加窗口高度，`Cmd+Shift+-` / `Cmd+-` 减少窗口高度。
- **代码画布翻半页**：全局快捷键 `Cmd+Shift+↓` / `Cmd+↓` 向下翻半页，`Cmd+Shift+↑` / `Cmd+↑` 向上翻半页。
- **屏幕录制权限门禁**：macOS 环境智能检测权限并提供 3 步直达授权指引；Windows 环境免授权无缝直通。
- **双重截图上传引擎**：30 秒定时静默上传 + WebSocket 毫秒级响应房主 On-Demand 截屏指令。
- **Glassmorphism HUD**：支持 48px 胶囊折叠、4 档透明度调节、截图倒计时与即时响应状态反馈。

---

## 📁 Monorepo 目录结构

```
coder_pad_平替/
├── package.json              # Monorepo workspaces 根配置
├── server/                   # 核心服务端 (Express + Yjs + Command Gateway + REST API)
│   ├── src/
│   │   ├── commandGateway.ts # WebSocket 双向控制网关 (心跳、权限感知、截屏下发)
│   │   ├── persistence.ts    # 房间隔离持久化 (doc.bin + meta.json + screenshots)
│   │   ├── routes.ts         # REST API (房间管理、截图上传/列表/文件流分发)
│   │   ├── websocket.ts      # Yjs 协同连接器
│   │   └── index.ts          # 服务端入口
├── client/                   # Web 协同前端 (React 18 + CodeMirror 6 + Tailwind)
├── server-app/               # [macOS App] 主控端桌面应用 (Electron + React)
│   ├── src/
│   │   ├── main/             # 主进程: 自动化内嵌服务、Cloudflare 穿透、Finder 调用
│   │   └── renderer/         # UI 控制台: 房间列表、监控大屏、On-Demand 按钮、画廊
└── desktop-agent/            # [跨平台 App] 被控端桌面伴侣 (macOS/Windows + Electron + React)
    ├── build/                # 应用图标 (.icns, .ico, .png)
    ├── src/
    │   ├── main/             # 主进程: 防录屏隐形、置顶漫游、穿透、权限检测、屏幕抓取
    │   └── renderer/         # UI 悬浮窗: 权限引导、连接配置、Glassmorphism HUD
```

---

## 🚀 启动与开发指南

### 1. 安装依赖
```bash
npm install
```

### 2. 本地开发模式

```bash
# 启动 Web 端协同开发 (Server: http://localhost:3000, Web: http://localhost:5173)
npm run dev

# 启动 macOS 主控端 Server App (开发调试)
npm run dev:server-app

# 启动被控端 Desktop Agent (开发调试)
npm run dev:agent
```

### 3. 一键构建所有工程
```bash
npm run build:all
```

### 4. 构建多端原生安装包与可执行文件

#### 📦 被控端 Desktop Agent 多平台构建：
```bash
# 1. 构建 Mac Intel 处理器版本 (.dmg / .zip)
npm run package:agent:mac:intel

# 2. 构建 Mac Apple Silicon (M1/M2/M3/M4) 版本 (.dmg / .zip)
npm run package:agent:mac:arm

# 3. 构建 Windows 版本
npm run package:agent:win:zip      # 构建免安装便携 Zip 包 (解压后直接双击运行，推荐)
npm run package:agent:win:portable # 构建单文件绿色便携版 (.exe)
npm run package:agent:win:dir      # 快速生成 unpacked 绿色运行目录
npm run package:agent:win          # 构建完整安装包与全套 Windows 产物

# 4. 一键构建所有平台包 (Mac + Windows)
npm run package:agent:all
```

#### 📦 主控端 Server App 构建：
```bash
npm run package:mac --workspace=server-app
```

打包产物将分别输出在 `server-app/release/` 与 `desktop-agent/release/` 目录下。

---

## 🧪 运行测试套件

```bash
# 运行 Yjs 多客户端高并发 CRDT 协同与持久化测试
npm run test:sync --workspace=server

# 运行房间隔离迁移、截图上传分发与 WebSocket 控制信道测试
npx tsx server/test/task1_server_enhancement_test.ts
```
