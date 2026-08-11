# PC Dynamic Island

面向 Windows 的 **Dynamic Island（灵动岛）风格桌面应用**，用 Electron + React + TypeScript 构建。

A **Dynamic Island-style desktop app for Windows**, built with Electron + React + TypeScript.

点击顶部居中的黑色胶囊展开成大面板；折叠时胶囊以外的区域鼠标可穿透，不会挡住桌面上的其他窗口。

Click the black capsule at the top center to expand it into a large panel; when collapsed, the area outside the capsule is click-through, so it never blocks other windows on your desktop.

## 下载 / Download

**Windows x64**（NSIS 安装包，约 80 MB）· NSIS installer (~80 MB)

- [⬇️ 下载最新版 · Download latest](https://github.com/WDream-BYZM/PC-Dynamic-Island/releases/latest/download/PC-Dynamic-Island-Setup-1.1.0.exe)
- [📦 所有版本 · All releases](https://github.com/WDream-BYZM/PC-Dynamic-Island/releases)

> 安装后常驻任务栏顶部中央，点击胶囊展开、按 `Esc` 或点击外部收起。
> After install, a capsule stays at the top center; click to expand, press `Esc` or click outside to collapse.

## 功能 / Features

- **总览 / Overview**：实时时钟、日期、时段问候 · Live clock, date, and time-of-day greeting
- **天气 / Weather**：实时天气 + 3 天预报（[Open-Meteo](https://open-meteo.com/) 免费 API，无需 key）· Current weather + 3-day forecast (free [Open-Meteo](https://open-meteo.com/) API, no key needed)
- **计时 / Timer**：倒计时圆环进度，可暂停 / 继续 / 重置 · Countdown ring with pause / resume / reset
- **设置 / Settings**：切换天气城市、窗口置顶开关、退出 · Change weather city, always-on-top toggle, quit

## 开发 / Development

```bash
npm install          # 首次安装依赖（若二进制未下载，运行 npm approve-scripts electron esbuild）
                     # Install dependencies (if binaries fail to download, run npm approve-scripts electron esbuild)
npm run dev          # 启动 Vite + Electron · Start Vite + Electron
npm run build        # 生产构建（Electron 主进程 + 渲染进程）· Production build (main + renderer)
npm start            # 以生产构建运行 · Run with production build
```

> 提示 / Tip：`npm run dev` 启动后，顶部会弹出一个黑色灵动岛胶囊，点击展开；按 `Esc` 或点击面板外区域收起。
> After `npm run dev` starts, a black capsule appears at the top center — click to expand; press `Esc` or click outside to collapse.

## 技术要点 / Technical Highlights

- **透明置顶窗口 / Transparent always-on-top window**：`transparent + frame:false + alwaysOnTop + skipTaskbar`，常驻不退出 · Always running, never exits
- **鼠标穿透 / Click-through**：折叠态用 `setIgnoreMouseEvents(true, { forward: true })` + 渲染层 `mousemove` 热点检测，胶囊外不拦截鼠标 · Uses `setIgnoreMouseEvents(true, { forward: true })` + renderer `mousemove` hotspot detection; the area outside the capsule doesn't capture the mouse
- **动画 / Animation**：仅用 `transform` / `opacity`，尊重 `prefers-reduced-motion` · Only animates `transform` / `opacity`, respects `prefers-reduced-motion`
- **架构 / Architecture**：`electron/main.ts`（主进程 + IPC / main process + IPC）· `electron/preload.ts`（contextBridge）· `src/`（React 渲染层 / renderer）

## 目录 / Structure

```
electron/           主进程与预加载脚本 · Main process & preload
src/
  components/
    Island.tsx      灵动岛容器（胶囊 / 面板 / 导航）· Island container (capsule / panel / nav)
    screens/        功能屏 · Feature screens
  App.tsx           展开状态 + 鼠标穿透逻辑 · Expand state + click-through logic
```

## 许可 / License

GPL-3.0
