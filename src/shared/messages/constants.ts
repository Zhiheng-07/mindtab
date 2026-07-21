// 跨上下文消息常量与类型（Background ↔ NewTab/Popup）
// Background 写入后广播，UI 端订阅刷新。

import type { PendingBookmark } from '@/shared/db'

export const MSG = {
  pendingAdded: 'mt:pending-added',
  pendingRemoved: 'mt:pending-removed',
  pendingUpdated: 'mt:pending-updated',
  bookmarkAdded: 'mt:bookmark-added',
  bookmarkChanged: 'mt:bookmark-changed',
  saveUrl: 'mt:save-url',
  retryIndex: 'mt:retry-index',
  triggerDrain: 'mt:trigger-drain',
} as const

export type Message =
  | { type: typeof MSG.pendingAdded; payload: PendingBookmark }
  | { type: typeof MSG.pendingRemoved; payload: { id: string } }
  | { type: typeof MSG.pendingUpdated; payload: { id: string; patch: Partial<PendingBookmark> } }
  | { type: typeof MSG.bookmarkAdded; payload: { id: string } }
  | { type: typeof MSG.bookmarkChanged; payload: { id: string } }
  | { type: typeof MSG.saveUrl; payload: { url: string; title?: string } }
  | { type: typeof MSG.retryIndex }
  | { type: typeof MSG.triggerDrain }
