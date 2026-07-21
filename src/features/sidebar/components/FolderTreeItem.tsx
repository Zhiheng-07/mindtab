// 递归文件夹树节点。
// 有子时显示 ▸ 指示；hover 150ms 飞出右侧子面板；子面板可继续递归。
// 拖放通过 dnd-kit useDroppable 实现，由 App 层 DndContext 统一处理。

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDroppable } from '@dnd-kit/core'
import type { Folder } from '@/shared/db'
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu'
import { IconChevronRight } from '@/shared/ui/icons'

const HOVER_OPEN_DELAY = 150
const HOVER_CLOSE_DELAY = 200

interface Props {
  folder: Folder
  count: number
  children: Folder[]
  childCount: (id: string) => number
  childrenOf: (parentId: string) => Folder[]
  active: string | null // 当前 activeFolderId（string）
  onSelect: (id: string) => void
  onRename: (id: string, oldName: string) => void
  onDelete: (id: string, name: string) => void
  /** 浮层层级（顶层 = 0） */
  depth?: number
}

export function FolderTreeItem({
  folder,
  count,
  children,
  childCount,
  childrenOf,
  active,
  onSelect,
  onRename,
  onDelete,
  depth = 0,
}: Props) {
  const [flyout, setFlyout] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const openTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const itemRef = useRef<HTMLButtonElement>(null)

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
  })

  const hasChildren = children.length > 0
  const isActive = active === folder.id

  const cancelOpen = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current)
      openTimer.current = undefined
    }
  }
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = undefined
    }
  }
  const scheduleOpen = () => {
    if (!hasChildren) return
    cancelClose()
    cancelOpen()
    openTimer.current = setTimeout(() => setFlyout(true), HOVER_OPEN_DELAY) as unknown as number
  }
  const scheduleClose = () => {
    cancelOpen()
    cancelClose()
    closeTimer.current = setTimeout(() => setFlyout(false), HOVER_CLOSE_DELAY) as unknown as number
  }

  useEffect(
    () => () => {
      cancelOpen()
      cancelClose()
    },
    [],
  )

  const menuItems: ContextMenuItem[] = [
    { key: 'rename', label: '重命名', onSelect: () => onRename(folder.id, folder.name) },
    { key: 'del', label: '删除', danger: true, onSelect: () => onDelete(folder.id, folder.name) },
  ]

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={(el) => {
          // 同时绑定 itemRef（用于 flyout 定位）和 dropRef（dnd-kit droppable）
          ;(itemRef as React.MutableRefObject<HTMLButtonElement | null>).current = el
          setDropRef(el)
        }}
        onClick={() => onSelect(folder.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          borderRadius: 'var(--mt-radius-md)',
          border: '1px solid transparent',
          background: isActive
            ? 'var(--mt-surface-active)'
            : isOver
              ? 'var(--mt-surface-hover)'
              : (flyout || hovered)
                ? 'var(--mt-surface-hover)'
                : 'transparent',
          borderColor: isOver ? 'var(--mt-border-hover)' : 'transparent',
          color: isActive ? 'var(--mt-text-strong)' : 'var(--mt-text-secondary)',
          fontSize: 13,
          fontWeight: isActive ? 500 : 400,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'background 120ms ease',
        }}
      >
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {folder.name}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mt-text-placeholder)' }}>{count}</span>
        <span style={{ color: 'var(--mt-text-placeholder)', display: 'inline-flex' }}>
          <IconChevronRight size={12} />
        </span>
      </button>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {flyout && hasChildren && itemRef.current &&
        createPortal(
          <Flyout
            anchor={itemRef.current.getBoundingClientRect()}
            onMouseEnter={() => {
              cancelClose()
            }}
            onMouseLeave={scheduleClose}
          >
            {children.map((c) => (
              <FolderTreeItem
                key={c.id}
                folder={c}
                count={childCount(c.id)}
                children={childrenOf(c.id)}
                childCount={childCount}
                childrenOf={childrenOf}
                active={active}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
                depth={depth + 1}
              />
            ))}
          </Flyout>,
          document.body,
        )}
    </div>
  )
}

function Flyout({
  anchor,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  anchor: DOMRect
  onMouseEnter: () => void
  onMouseLeave: () => void
  children: React.ReactNode
}) {
  const left = anchor.right + 6
  const top = anchor.top
  const maxHeight = window.innerHeight - top - 16
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="glass-solid glass-border"
      style={{
        position: 'fixed',
        top,
        left,
        minWidth: 200,
        maxWidth: 240,
        maxHeight,
        overflow: 'hidden',
        borderRadius: 'var(--mt-radius-lg)',
        zIndex: 180,
      }}
    >
      <div
        style={{
          maxHeight: maxHeight - 2,
          overflowY: 'auto',
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {children}
      </div>
    </div>
  )
}
