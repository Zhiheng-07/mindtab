// 主内容区（从 App.tsx 抽出）。
// 引导卡片 + AI 未配置横幅 + 置顶行 + FilterBar + 书签网格 / skeleton。

import { useState, type RefObject } from 'react'
import { SkeletonCard } from '@/shared/ui/Skeleton'
import type { Bookmark } from '@/shared/db'
import { useAiConfiguredState } from '@/shared/lib/aiStatus'
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
  onOpenSettings: () => void
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
  onOpenSettings,
}: AppMainProps) {
  // null = 尚未读取完成：此时不渲染横幅，避免已配置用户看到一闪
  const aiConfigured = useAiConfiguredState()
  // 横幅 dismiss 只存内存：刷新页面后重新出现
  const [bannerDismissed, setBannerDismissed] = useState(false)

  return (
    <main className="mx-auto max-w-6xl px-6 pt-0 pb-32">
      {/* 没有书签时也显示：新用户跳过 AI 引导后靠它提醒 */}
      {aiConfigured === false && !bannerDismissed && (
        <AiWarningBanner
          onClick={onOpenSettings}
          onClose={() => setBannerDismissed(true)}
        />
      )}
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

function AiWarningBanner({ onClick, onClose }: { onClick: () => void; onClose: () => void }) {
  return (
    <div
      className="glass-border"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '10px 12px 10px 16px',
        marginBottom: 12,
        borderRadius: 'var(--mt-radius-lg)',
        background: 'var(--mt-bg-warning)',
        fontSize: 13,
        color: 'var(--mt-warning)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        ⚠️ AI 未配置，已跳过智能管理，可在设置中配置 API Key 后自动补齐
      </span>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button
          onClick={onClick}
          style={{
            background: 'transparent',
            border: '1px solid currentColor',
            borderRadius: 'var(--mt-radius-pill)',
            padding: '3px 12px',
            fontSize: 12,
            color: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'opacity 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          去配置 →
        </button>
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '2px 4px',
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.6,
            transition: 'opacity 120ms ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        >
          ×
        </button>
      </div>
    </div>
  )
}
