import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// 初始化主题（读取本地设置，默认深色）
document.documentElement.dataset.theme = localStorage.getItem('eisland.theme') || 'dark'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
