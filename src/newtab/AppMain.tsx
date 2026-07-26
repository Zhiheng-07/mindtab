// 主内容区（从 App.tsx 抽出）。
// 引导卡片 + 置顶行 + FilterBar + 书签网格 / skeleton。

import type { RefObject } from 'react'
import { SkeletonCard } from '@/shared/ui/Skeleton'
import type { Bookmark } from '@/shared/db'
import {
  BookmarkGrid,
  PinnedRow,
  type ContentTypeFilter,
} from '@/features/bookmarks'
import { FilterBar } from '@/features/filter'
import { ImportGuideCard } from '@/features/onboarding'

interface AppMainProps {
  filterBarRef: RefObject<HTMLDivElement | null>
  filterPinned: boolean
  isEmpty: boolean
  allPinned: boolean
  loading: boolean
  filter: ContentTypeFilter
  pinned: Bookmark[]
  visible: Bookmark[]
  onOpen: (b: { id: string; url: string }) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
  onAddUrl: () => void
}

export function AppMain({
  filterBarRef,
  filterPinned,
  isEmpty,
  allPinned,
  loading,
  filter,
  pinned,
  visible,
  onOpen,
  onTogglePin,
  onDelete,
  onAddUrl,
}: AppMainProps) {
  return (
    <main className="mx-auto max-w-6xl px-6 pt-0 pb-32">
      <ImportGuideCard />
      <PinnedRow
        items={pinned}
        onOpen={onOpen}
        onTogglePin={onTogglePin}
        onDelete={onDelete}
      />
      {!isEmpty && !allPinned && (
        <div
          ref={filterBarRef}
          style={{
            opacity: filterPinned ? 0 : 1,
            transform: filterPinned ? 'translateY(-6px)' : 'translateY(0)',
            transition: filterPinned
              ? 'opacity 120ms cubic-bezier(0.4, 0, 1, 1), transform 120ms cubic-bezier(0.4, 0, 1, 1)'
              : 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <FilterBar />
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        !allPinned && (
          <BookmarkGrid
            items={visible}
            loading={loading}
            isFiltered={filter !== 'all'}
            onOpen={onOpen}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            onAddUrl={onAddUrl}
          />
        )
      )}
    </main>
  )
}
