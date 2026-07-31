// App 的数据/编排层（从 App.tsx 抽出，App 只剩组装 JSX）。
// 负责：订阅书签 store、派生 pinned/visible、接通拖拽、滚动驱动的 filterPinned。
// 不持有"哪个 modal 开着"这类纯视图状态——那些留在 App.tsx。

import { useEffect, useMemo, useRef, useState } from 'react'
import { useDndHandlers } from '@/shared/dnd'
import { computePinned, computeVisible, useBookmarkStore } from '@/features/bookmarks'
import { useToastStore } from '@/features/toast'

export function useAppController() {
  const [filterPinned, setFilterPinned] = useState(false)
  const filterBarRef = useRef<HTMLDivElement>(null)

  const loading = useBookmarkStore((s) => s.loading)
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const folders = useBookmarkStore((s) => s.folders)
  const filter = useBookmarkStore((s) => s.filter)
  const sort = useBookmarkStore((s) => s.sort)
  const activeFolderId = useBookmarkStore((s) => s.activeFolderId)
  const remove = useBookmarkStore((s) => s.remove)
  const togglePinned = useBookmarkStore((s) => s.togglePinned)
  const reorder = useBookmarkStore((s) => s.reorder)
  const moveToFolder = useBookmarkStore((s) => s.moveToFolder)
  const setSort = useBookmarkStore((s) => s.setSort)
  const touch = useBookmarkStore((s) => s.touch)
  const pushToast = useToastStore((s) => s.pushToast)

  const isEmpty = !loading && bookmarks.length === 0

  const pinned = useMemo(
    () => computePinned(bookmarks, activeFolderId, folders),
    [bookmarks, activeFolderId, folders],
  )
  const visible = useMemo(
    () => computeVisible(bookmarks, filter, sort, activeFolderId, folders),
    [bookmarks, filter, sort, activeFolderId, folders],
  )

  const allPinned = !loading && visible.length === 0 && pinned.length > 0

  // ── 统一 dnd-kit 拖拽（逻辑在 shared/dnd/useDndHandlers）──
  const dnd = useDndHandlers({
    items: bookmarks,
    pinned,
    grid: visible,
    onMoveToFolder: (id, folderId) => {
      void moveToFolder(id, folderId).then(() => {
        pushToast('success', '已移动', 'dnd-moved')
      })
    },
    onReorderPinned: (ids) => {
      void reorder(ids)
    },
    onReorderGrid: (ids) => {
      if (sort !== 'manual') setSort('manual')
      void reorder(ids)
    },
  })

  // filterPinned 控制 header 中 compact FilterBar 的显示
  // 依赖 isEmpty + allPinned：确保 FilterBar 挂载/卸载后重新绑定滚动监听。
  // 空态/全置顶下的强制 false 由返回值派生表达（不在 effect 里同步 setState）
  useEffect(() => {
    if (isEmpty || allPinned) return
    const el = filterBarRef.current
    if (!el) return
    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      // 滞回带（76/84）：pin 与 unpin 阈值分开，避免在临界点来回滚动时抖动
      // 用户要求触发时机提前 20px（原 56/64 → 76/84）
      setFilterPinned((prev) => {
        if (prev) return rect.bottom <= 84
        return rect.bottom < 76
      })
    }
    // 重新绑定后的首判不带滞回（等价旧实现「先重置 false 再按 76 判定」）
    const raf = requestAnimationFrame(() => {
      setFilterPinned(el.getBoundingClientRect().bottom < 76)
    })
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
    }
  }, [isEmpty, allPinned])

  const openBookmark = (b: { id: string; url: string }) => {
    void touch(b.id)
    window.open(b.url, '_blank', 'noopener,noreferrer')
  }

  const scopeLabel =
    activeFolderId === 'all'
      ? '全部'
      : activeFolderId === null
        ? '未分类'
        : (folders.find((f) => f.id === activeFolderId)?.name ?? '文件夹')

  return {
    // 状态
    loading,
    filter,
    activeFolderId,
    isEmpty,
    allPinned,
    pinned,
    visible,
    filterPinned: filterPinned && !isEmpty && !allPinned,
    filterBarRef,
    scopeLabel,
    // 书签操作
    remove,
    togglePinned,
    openBookmark,
    // 拖拽
    dnd,
  }
}
