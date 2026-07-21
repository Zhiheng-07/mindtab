// DndContext + DragOverlay 的包装器（从 App.tsx 提取）。
// 把 dnd-kit 的样板收进来：调用方只需把 useDndHandlers 的返回值透传进来，
// 并通过 overlay 提供拖拽浮层内容（浮层长什么样是业务相关的，由调用方决定）。

import type { ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { useDndHandlers } from './useDndHandlers'

type DndHandlers = ReturnType<typeof useDndHandlers>

interface DndShellProps {
  sensors: DndHandlers['sensors']
  onDragStart: (e: DragStartEvent) => void
  onDragOver: (e: DragOverEvent) => void
  onDragEnd: (e: DragEndEvent) => void
  onDragCancel: () => void
  /** 拖拽浮层内容（业务相关，由调用方根据 activeItem 渲染）*/
  overlay: ReactNode
  children: ReactNode
}

export function DndShell({
  sensors,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  overlay,
  children,
}: DndShellProps) {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{ screenReaderInstructions: { draggable: '' } }}
    >
      {children}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  )
}
