import { useState } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Bookmark } from '@/shared/db'
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu'
import { Favicon } from '@/shared/ui/Favicon'

interface Props {
  items: Bookmark[]
  onOpen: (item: Bookmark) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}

export function PinnedRow({ items, onOpen, onTogglePin, onDelete }: Props) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  if (items.length === 0) return null

  const target = items.find((b) => b.id === menu?.id)
  const menuItems: ContextMenuItem[] = target
    ? [
        { key: 'unpin', label: '取消置顶', onSelect: () => onTogglePin(target.id) },
        { key: 'del', label: '删除', danger: true, onSelect: () => onDelete(target.id) },
      ]
    : []

  return (
    <>
      <SortableContext items={items.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div
          aria-label="置顶书签"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            rowGap: 20,
            columnGap: 12,
            padding: '8px 0 36px',
            justifyItems: 'center',
          }}
        >
          {items.map((b) => (
            <SortablePinnedItem
              key={b.id}
              item={b}
              onOpen={() => onOpen(b)}
              onContext={(x, y) => setMenu({ id: b.id, x, y })}
            />
          ))}
        </div>
      </SortableContext>

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

function SortablePinnedItem({
  item,
  onOpen,
  onContext,
}: {
  item: Bookmark
  onOpen: () => void
  onContext: (x: number, y: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    transition: { duration: 10, easing: 'linear' },
  })

  const [hovered, setHovered] = useState(false)

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault()
        onContext(e.clientX, e.clientY)
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item.title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: 72,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <span
        style={{
          border: '1px solid var(--mt-border)',
          width: 48,
          height: 48,
          borderRadius: 'var(--mt-radius-pill)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          color: 'var(--mt-text-muted)',
          fontWeight: 500,
          background: hovered ? 'var(--mt-glass-bg-hover)' : 'var(--mt-glass-bg)',
          backdropFilter: 'var(--mt-glass-blur)',
          borderColor: hovered ? 'var(--mt-pinned-border-hover)' : undefined,
          transition: 'background 280ms cubic-bezier(0.4, 0, 0.2, 1), border-color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Favicon src={item.favicon} domain={item.domain} title={item.title} size={30} rounded />
      </span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--mt-text-secondary)',
          maxWidth: 72,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.title || item.domain}
      </span>
    </button>
  )
}
