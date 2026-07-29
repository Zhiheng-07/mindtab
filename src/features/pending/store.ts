import { create } from 'zustand'
import { type PendingBookmark } from '@/shared/db'
import {
  deletePending as dbDeletePending,
  getAllPending,
  updatePending as dbUpdatePending,
} from './db'
import { MSG, type Message } from '@/shared/messages'
import { useToastStore, type ToastMessage } from '@/features/toast'

interface PendingState {
  pending: PendingBookmark[]
  hydratePending: () => Promise<void>
  removePending: (id: string) => Promise<void>
  renamePending: (id: string, title: string) => Promise<void>
}

export const usePendingStore = create<PendingState>((set) => ({
  pending: [],
  hydratePending: async () => {
    const list = await getAllPending()
    list.sort((a, b) => b.createdAt - a.createdAt)
    set({ pending: list })
  },
  removePending: async (id) => {
    await dbDeletePending(id)
    set((s) => ({ pending: s.pending.filter((p) => p.id !== id) }))
  },
  renamePending: async (id, title) => {
    await dbUpdatePending(id, { title })
    set((s) => ({
      pending: s.pending.map((p) => (p.id === id ? { ...p, title } : p)),
    }))
  },
}))

// ───── 订阅 Background 广播 ─────
let subscribed = false
let pendingHydrateTimer: ReturnType<typeof setTimeout> | null = null

function debouncedHydratePending(): void {
  if (pendingHydrateTimer) clearTimeout(pendingHydrateTimer)
  pendingHydrateTimer = setTimeout(() => {
    pendingHydrateTimer = null
    void usePendingStore.getState().hydratePending()
  }, 300)
}

export function subscribeRuntimeMessages(): void {
  if (subscribed) return
  subscribed = true
  chrome.runtime.onMessage.addListener((msg: Message | ToastMessage) => {
    if (!msg || typeof msg !== 'object') return
    const pushToast = useToastStore.getState().pushToast
    switch (msg.type) {
      case MSG.pendingAdded:
        debouncedHydratePending()
        pushToast('success', '已添加到待确认', 'pending-add')
        break
      case MSG.pendingRemoved:
        debouncedHydratePending()
        break
      case MSG.pendingUpdated:
        debouncedHydratePending()
        break
      case 'mt:toast':
        pushToast(msg.payload.kind, msg.payload.message)
        break
    }
  })
}
