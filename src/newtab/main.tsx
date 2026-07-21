import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { subscribeRuntimeMessages, usePendingStore } from '@/features/pending'
import {
  subscribeBookmarkMessages,
  useBookmarkStore,
} from '@/features/bookmarks'
import { useThemeStore } from '@/features/theme'
import '../styles/globals.css'

// 启动：先 hydrate 主题（避免闪一下亮模式）
void useThemeStore.getState().hydrate()

// 订阅跨上下文消息 + 预热数据
subscribeRuntimeMessages()
subscribeBookmarkMessages()
void usePendingStore.getState().hydratePending()
void useBookmarkStore.getState().hydrate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
