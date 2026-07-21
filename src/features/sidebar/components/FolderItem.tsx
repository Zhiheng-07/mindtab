import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu'

interface Props {
  label: string
  count: number
  active: boolean
  /** 是否可作为拖放目标（"全部"通常不允许） */
  droppable?: boolean
  /** 作为 droppable 目标时的 id（如 'folder:xxx' / 'folder:'） */
  droppableId?: string
  /** 是否显示右键菜单（重命名/删除）—— 仅用户自建文件夹显示 */
  withMenu?: boolean
  onClick: () => void
  onRename?: () => void
  onDelete?: () => void
}

export function FolderItem({
  label,
  count,
  active,
  droppable = false,
  droppableId,
  withMenu = false,
  onClick,
  onRename,
  onDelete,
}: Props) {
  const [hovered, setHovered] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId ?? `folder-item:${label}`,
    disabled: !droppable,
  })

  const menuItems: ContextMenuItem[] = []
  if (onRename) menuItems.push({ key: 'rename', label: '重命名', onSelect: onRename })
  if (onDelete) menuItems.push({ key: 'del', label: '删除', danger: true, onSelect: onDelete })

  return (
    <>
      <button
        ref={setNodeRef}
        onClick={onClick}
        onContextMenu={
          withMenu
            ? (e) => {
                e.preventDefault()
                setMenu({ x: e.clientX, y: e.clientY })
              }
            : undefined
        }
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 12px',
          borderRadius: 'var(--mt-radius-md)',
          border: '1px solid transparent',
          background: active
            ? 'var(--mt-surface-active)'
            : (isOver || hovered)
              ? 'var(--mt-surface-hover)'
              : 'transparent',
          borderColor: isOver ? 'var(--mt-border-hover)' : 'transparent',
          color: active ? 'var(--mt-text-strong)' : 'var(--mt-text-secondary)',
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          transition: 'background 120ms ease',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--mt-text-placeholder)' }}>{count}</span>
      </button>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
