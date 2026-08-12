import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 初始化主题（读取本地设置，默认深色）
document.documentElement.dataset.theme = localStorage.getItem('eisland.theme') || 'dark'

// 内存优化：定期回收渲染进程 V8 未用堆内存（主进程 js-flags 已启用 --expose-gc）
setInterval(() => {
  try {
    ;(globalThis as any).gc?.()
  } catch {
    /* GC 不可用时忽略 */
  }
}, 30000)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
