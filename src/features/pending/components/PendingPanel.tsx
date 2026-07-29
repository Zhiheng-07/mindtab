import { AnimatePresence, motion } from 'motion/react'
import { usePendingStore } from '../store'
import { useToastStore } from '@/features/toast'
import { useBookmarkStore } from '@/features/bookmarks'
import { confirmPending } from '../db'
import { MSG, broadcast } from '@/shared/messages'
import { PendingCard } from './PendingCard'

const MAX_PENDING = 10

export function PendingPanel() {
  const pending = usePendingStore((s) => s.pending)
  const removePending = usePendingStore((s) => s.removePending)
  const renamePending = usePendingStore((s) => s.renamePending)
  const hydratePending = usePendingStore((s) => s.hydratePending)
  const pushToast = useToastStore((s) => s.pushToast)

  const handleConfirm = async (id: string) => {
    try {
      // 归入"当前活动文件夹"。activeFolderId === 'all' 视为未分类。
      const scope = useBookmarkStore.getState().activeFolderId
      const folderId = scope === 'all' ? null : scope
      const bookmark = await confirmPending(id, folderId)
      await hydratePending()
      // 本地 hydrate（chrome.runtime.sendMessage 不会回流到当前 newtab）
      await useBookmarkStore.getState().hydrate()
      // 广播给其它打开的 newtab
      broadcast({ type: MSG.bookmarkAdded, payload: { id: bookmark.id } })
      broadcast({ type: MSG.pendingRemoved, payload: { id } })
      pushToast('success', '已归入收藏库', 'pending-confirm')
    } catch (e) {
      pushToast('error', `归入失败：${(e as Error).message}`, 'pending-confirm-fail')
    }
  }

  return (
    <AnimatePresence>
      {pending.length > 0 && (
        <motion.aside
          key="pending-panel"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.24, ease: [0, 0, 0.2, 1] }}
          aria-label="待确认收藏面板"
          className="glass glass-border"
          style={{
            position: 'fixed',
            top: 80,
            right: 16,
            width: 300,
            maxHeight: 'calc(100vh - 96px)',
            borderRadius: 'var(--mt-radius-2xl)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <header
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid var(--mt-border-divider)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--mt-text-strong)',
              }}
            >
              待确认
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--mt-text-muted)',
                background: 'var(--mt-bg-secondary)',
                padding: '2px 8px',
                borderRadius: 'var(--mt-radius-pill)',
              }}
            >
              {pending.length} / {MAX_PENDING}
            </span>
          </header>

          <div
            style={{
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflowY: 'auto',
            }}
          >
            {pending.map((p) => (
              <PendingCard
                key={p.id}
                item={p}
                onRename={renamePending}
                onDelete={removePending}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
