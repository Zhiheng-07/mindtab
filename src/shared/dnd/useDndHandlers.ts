// 统一 dnd-kit 拖拽事件处理（从 App.tsx 提取）。
// 这是与具体业务无关的基础设施：所有书签数据与副作用都由调用方注入，
// 因此放在 shared/，不依赖任何 feature。

import { useState } from 'react'
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import type { Bookmark } from '@/shared/db'

interface DndHandlersInput {
  /** 所有可拖拽书签（用于 dragStart 时按 id 取当前项）*/
  items: Bookmark[]
  /** 置顶行有序列表（判断是否在置顶行内排序）*/
  pinned: Bookmark[]
  /** 网格有序列表（判断是否在网格内排序）*/
  grid: Bookmark[]
  /** 拖到文件夹：folderId 为 null 表示未分类 */
  onMoveToFolder: (id: string, folderId: string | null) => void
  /** 置顶行内排序：传入新顺序的 id 列表 */
  onReorderPinned: (ids: string[]) => void
  /** 网格内排序：传入新顺序的 id 列表（调用方负责切到 manual 排序）*/
  onReorderGrid: (ids: string[]) => void
}

interface DndHandlers {
  activeItem: Bookmark | null
  overFolder: boolean
  sensors: ReturnType<typeof useSensors>
  handleDragStart: (e: DragStartEvent) => void
  handleDragOver: (e: DragOverEvent) => void
  handleDragCancel: () => void
  handleDragEnd: (e: DragEndEvent) => void
}

export function useDndHandlers({
  items,
  pinned,
  grid,
  onMoveToFolder,
  onReorderPinned,
  onReorderGrid,
}: DndHandlersInput): DndHandlers {
  const [activeItem, setActiveItem] = useState<Bookmark | null>(null)
  const [overFolder, setOverFolder] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id)
    setActiveItem(items.find((b) => b.id === id) ?? null)
  }

  const handleDragOver = (e: DragOverEvent) => {
    setOverFolder(e.over ? String(e.over.id).startsWith('folder:') : false)
  }

  const handleDragCancel = () => {
    setActiveItem(null)
    setOverFolder(false)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveItem(null)
    setOverFolder(false)

    const { active, over } = e
    if (!over || active.id === over.id) return

    const overId = String(over.id)
    const activeId = String(active.id)

    // 拖到文件夹
    if (overId.startsWith('folder:')) {
      const folderId = overId.slice('folder:'.length) || null
      onMoveToFolder(activeId, folderId)
      return
    }

    // 置顶行内排序
    const pinnedIds = pinned.map((b) => b.id)
    if (pinnedIds.includes(activeId) && pinnedIds.includes(overId)) {
      const oldIdx = pinned.findIndex((b) => b.id === activeId)
      const newIdx = pinned.findIndex((b) => b.id === overId)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = [...pinned]
        const [moved] = reordered.splice(oldIdx, 1)
        reordered.splice(newIdx, 0, moved)
        onReorderPinned(reordered.map((b) => b.id))
      }
      return
    }

    // 网格内排序
    const gridIds = grid.map((b) => b.id)
    if (gridIds.includes(activeId) && gridIds.includes(overId)) {
      const oldIdx = grid.findIndex((b) => b.id === activeId)
      const newIdx = grid.findIndex((b) => b.id === overId)
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = [...grid]
        const [moved] = reordered.splice(oldIdx, 1)
        reordered.splice(newIdx, 0, moved)
        onReorderGrid(reordered.map((b) => b.id))
      }
      return
    }
  }

  return {
    activeItem,
    overFolder,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
  }
}
