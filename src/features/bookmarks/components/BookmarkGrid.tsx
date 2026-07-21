import { useEffect, useRef, useState } from 'react'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Bookmark } from '@/shared/db'
import { IconPlus } from '@/shared/ui/icons'
import { BookmarkCard } from './BookmarkCard'

const PAGE_SIZE = 20

interface Props {
  items: Bookmark[]
  loading: boolean
  /** 'all' 时是真正的空库；其他值时空态意味着"该分类下无内容" */
  isFiltered: boolean
  onOpen: (item: Bookmark) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onAddUrl: () => void
}

export function BookmarkGrid({
  items,
  loading,
  isFiltered,
  onOpen,
  onTogglePin,
  onDelete,
  onAddUrl,
}: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // 列表变了重置可见数量
  useEffect(() => setVisible(PAGE_SIZE), [items.length])

  useEffect(() => {
    if (!sentinelRef.current) return
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE_SIZE, items.length))
        }
      },
      { rootMargin: '300px' },
    )
    ob.observe(sentinelRef.current)
    return () => ob.disconnect()
  }, [items.length])

  if (!loading && items.length === 0) {
    return isFiltered ? <FilteredEmpty /> : <EmptyState onAddUrl={onAddUrl} />
  }

  const show = items.slice(0, visible)

  return (
    <div>
      <SortableContext items={show.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            columnGap: 14,
            rowGap: 14,
            alignItems: 'start',
            gridAutoRows: 'minmax(149px, auto)',
          }}
        >
          {show.map((b) => (
            <SortableBookmarkCard
              key={b.id}
              item={b}
              onOpen={onOpen}
              onTogglePin={onTogglePin}
              onDelete={onDelete}
            />
          ))}
          <AddCard onClick={onAddUrl} />
        </div>
      </SortableContext>
      <div ref={sentinelRef} style={{ height: 1 }} />
    </div>
  )
}

function SortableBookmarkCard({
  item,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  item: Bookmark
  onOpen: (item: Bookmark) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
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

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 10 : undefined,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <BookmarkCard
        item={item}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
    </div>
  )
}

function AddCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="添加网址"
      style={{
        minHeight: 149,
        height: '100%',
        background: 'var(--mt-glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px dashed var(--mt-border)',
        borderRadius: 22,
        color: 'var(--mt-text-muted)',
        cursor: 'pointer',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--mt-border-hover)'
        e.currentTarget.style.color = 'var(--mt-text-primary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--mt-border)'
        e.currentTarget.style.color = 'var(--mt-text-muted)'
      }}
    >
      <IconPlus size={16} />
      <span>添加网址</span>
    </button>
  )
}

function FilteredEmpty() {
  return (
    <div
      style={{
        padding: '48px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        color: 'var(--mt-text-muted)',
      }}
    >
      <div style={{ fontSize: 14 }}>该分类下暂无内容</div>
      <div style={{ fontSize: 12, color: 'var(--mt-text-placeholder)' }}>
        分类来自 AI 索引；新条目会随索引完成自动归类
      </div>
    </div>
  )
}

function EmptyState({ onAddUrl }: { onAddUrl: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{
        padding: '64px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        color: 'var(--mt-text-muted)',
      }}
    >
      <div style={{ fontSize: 14 }}>暂无收藏</div>
      <div style={{ fontSize: 12, color: 'var(--mt-text-placeholder)', textAlign: 'center', lineHeight: 1.6 }}>
        点击 MindTab 扩展图标 或 鼠标右键点击 MindTab<br />
        即可收藏目标网址
      </div>
      <button
        onClick={onAddUrl}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '8px 14px',
          background: 'var(--mt-accent)',
          color: 'var(--mt-accent-fg)',
          border: '1px solid var(--mt-accent)',
          borderRadius: 'var(--mt-radius-md)',
          fontSize: 13,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          opacity: hovered ? 0.82 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        <IconPlus size={14} /> 添加网址
      </button>
    </div>
  )
}
