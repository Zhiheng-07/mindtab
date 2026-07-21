import { useEffect, useMemo, useRef, useState } from 'react'
import { scopeKey } from '@/shared/db'
import {
  useBookmarkStore,
  type ContentTypeFilter,
  type SortKey,
} from '@/features/bookmarks'
import type { Bookmark } from '@/shared/db'

const ALL_CONTENT_TYPES: { key: ContentTypeFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '文章', label: '文章' },
  { key: '视频', label: '视频' },
  { key: '工具', label: '工具' },
  { key: '文档', label: '文档' },
  { key: '其他', label: '其他' },
]

/** 返回当前 scope 下有内容的 contentType 集合 */
function useVisibleTypes() {
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const scope = useBookmarkStore((s) => s.activeFolderId)
  const folders = useBookmarkStore((s) => s.folders)

  return useMemo(() => {
    // inScope 逻辑内联：与 bookmarkStore.computeVisible 保持一致
    const inScope = (b: Bookmark) => {
      if (scope === 'all') return true
      if (scope === null) return b.folderId === null
      // 递归收集后代文件夹
      const ids = new Set<string>([scope])
      let changed = true
      while (changed) {
        changed = false
        for (const f of folders) {
          if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
            ids.add(f.id)
            changed = true
          }
        }
      }
      return b.folderId !== null && ids.has(b.folderId)
    }

    const types = new Set<string>()
    for (const b of bookmarks) {
      if (!(b.pinnedIn ?? []).includes(scopeKey(scope)) && inScope(b) && b.contentType) {
        types.add(b.contentType)
      }
    }
    return types
  }, [bookmarks, scope, folders])
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: '最近打开' },
  { key: 'manual', label: '手动' },
  { key: 'oldest', label: '最早收藏' },
  { key: 'alpha', label: '字母' },
]

export function FilterBar({ compact = false }: { compact?: boolean }) {
  const filter = useBookmarkStore((s) => s.filter)
  const sort = useBookmarkStore((s) => s.sort)
  const setFilter = useBookmarkStore((s) => s.setFilter)
  const setSort = useBookmarkStore((s) => s.setSort)
  const visibleTypes = useVisibleTypes()

  // 只保留有内容的类型（"全部"始终显示）
  const contentTypes = useMemo(
    () => ALL_CONTENT_TYPES.filter((t) => t.key === 'all' || visibleTypes.has(t.key)),
    [visibleTypes],
  )

  // 如果当前选中的 filter 已无内容，自动回退到"全部"
  useEffect(() => {
    if (filter !== 'all' && !visibleTypes.has(filter)) {
      setFilter('all')
    }
  }, [filter, visibleTypes, setFilter])

  return (
    <div className={`flex items-center justify-between gap-4 flex-wrap px-2 w-full ${compact ? 'py-0' : 'pt-3 pb-6'}`}>
      <TabGroup
        items={contentTypes}
        activeKey={filter}
        onSelect={(key) => setFilter(key as ContentTypeFilter)}
      />
      <SegmentGroup
        items={SORT_OPTIONS}
        activeKey={sort}
        onSelect={(key) => setSort(key as SortKey)}
      />
    </div>
  )
}

/* ── 左侧：Tab 下划线风格 ── */

function TabGroup<T extends string>({
  items,
  activeKey,
  onSelect,
}: {
  items: { key: T; label: string }[]
  activeKey: T
  onSelect: (key: T) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = itemRefs.current.get(activeKey)
    const container = containerRef.current
    if (!el || !container) return

    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setIndicator({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    })

    if (!ready) {
      requestAnimationFrame(() => setReady(true))
    }
  }, [activeKey, ready])

  return (
    <nav
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24 }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          ref={(el) => {
            if (el) itemRefs.current.set(item.key, el)
          }}
          onClick={() => onSelect(item.key)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 0',
            fontSize: 13,
            fontWeight: activeKey === item.key ? 500 : 400,
            color: activeKey === item.key ? 'var(--mt-text-strong)' : 'var(--mt-text-muted)',
            transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            if (activeKey !== item.key) {
              e.currentTarget.style.color = 'var(--mt-text-strong)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeKey !== item.key) {
              e.currentTarget.style.color = 'var(--mt-text-muted)'
            }
          }}
        >
          {item.label}
        </button>
      ))}

      <span
        style={{
          position: 'absolute',
          bottom: 0,
          height: 1.5,
          borderRadius: 1,
          background: 'var(--mt-text-strong)',
          left: indicator.left,
          width: indicator.width,
          transition: ready
            ? 'left 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
        }}
      />
    </nav>
  )
}

/* ── 右侧：分段控制器（弱化层级） ── */

function SegmentGroup<T extends string>({
  items,
  activeKey,
  onSelect,
}: {
  items: { key: T; label: string }[]
  activeKey: T
  onSelect: (key: T) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [pill, setPill] = useState({ left: 0, width: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = itemRefs.current.get(activeKey)
    const container = containerRef.current
    if (!el || !container) return

    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setPill({
      left: elRect.left - containerRect.left,
      width: elRect.width,
    })

    if (!ready) {
      requestAnimationFrame(() => setReady(true))
    }
  }, [activeKey, ready])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 8,
        border: '1px solid var(--mt-border)',
        padding: 3,
        background: 'transparent',
      }}
    >
      {/* 滑动背景 pill */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          bottom: 3,
          left: pill.left,
          width: pill.width,
          borderRadius: 5,
          background: 'var(--mt-glass-bg-hover)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          transition: ready
            ? 'left 280ms cubic-bezier(0.4, 0, 0.2, 1), width 280ms cubic-bezier(0.4, 0, 0.2, 1)'
            : 'none',
        }}
      />

      {items.map((item) => (
        <button
          key={item.key}
          ref={(el) => {
            if (el) itemRefs.current.set(item.key, el)
          }}
          onClick={() => onSelect(item.key)}
          style={{
            position: 'relative',
            zIndex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: activeKey === item.key ? 500 : 400,
            color: activeKey === item.key ? 'var(--mt-text-primary)' : 'var(--mt-text-muted)',
            transition: 'color 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            if (activeKey !== item.key) {
              e.currentTarget.style.color = 'var(--mt-text-primary)'
            }
          }}
          onMouseLeave={(e) => {
            if (activeKey !== item.key) {
              e.currentTarget.style.color = 'var(--mt-text-muted)'
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
