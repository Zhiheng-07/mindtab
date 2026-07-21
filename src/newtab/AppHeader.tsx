// 顶部栏（从 App.tsx 抽出）。
// 纯展示 + 回调：是否显示侧栏按钮、folder badge、固定 FilterBar 由上层传入的状态决定。

import { Settings as SettingsIcon } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { LottieMenuIcon } from '@/features/sidebar'
import { FilterBar } from '@/features/filter'
import type { FolderScope } from '@/features/bookmarks'

interface AppHeaderProps {
  filterPinned: boolean
  sidebarOpen: boolean
  activeFolderId: FolderScope
  scopeLabel: string
  isEmpty: boolean
  allPinned: boolean
  onOpenSidebar: () => void
  onOpenSettings: () => void
}

export function AppHeader({
  filterPinned,
  sidebarOpen,
  activeFolderId,
  scopeLabel,
  isEmpty,
  allPinned,
  onOpenSidebar,
  onOpenSettings,
}: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: filterPinned ? 'var(--mt-glass-bg-solid)' : 'transparent',
        backdropFilter: filterPinned ? 'var(--mt-glass-blur)' : 'none',
        borderBottom: `1px solid ${filterPinned ? 'var(--mt-glass-border)' : 'transparent'}`,
        transition: filterPinned
          ? 'background 300ms cubic-bezier(0, 0, 0.2, 1), backdrop-filter 300ms cubic-bezier(0, 0, 0.2, 1), border-color 300ms cubic-bezier(0, 0, 0.2, 1)'
          : 'background 120ms cubic-bezier(0.4, 0, 1, 1), backdrop-filter 120ms cubic-bezier(0.4, 0, 1, 1), border-color 120ms cubic-bezier(0.4, 0, 1, 1)',
      }}
    >
      <div className="flex items-center justify-between px-6 py-3" style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
        <div className="flex items-center gap-3" style={{ pointerEvents: 'auto' }}>
          {!sidebarOpen && (
            <Button
              variant="outline"
              size="icon"
              aria-label="打开侧导栏"
              onClick={onOpenSidebar}
            >
              <LottieMenuIcon open={false} size={18} />
            </Button>
          )}
          {activeFolderId !== 'all' && (
            <Badge variant="secondary" className="text-xs font-normal border-border">
              {scopeLabel}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
          <Button
            variant="outline"
            size="icon"
            aria-label="设置"
            onClick={onOpenSettings}
          >
            <SettingsIcon />
          </Button>
        </div>
      </div>

      {/* 固定 FilterBar — 绝对定位，与 main 的 max-w-6xl 对齐 */}
      {!isEmpty && !allPinned && (
        <div
          className="mx-auto max-w-6xl px-6"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            opacity: filterPinned ? 1 : 0,
            pointerEvents: filterPinned ? 'auto' : 'none',
            transition: filterPinned
              ? 'opacity 300ms cubic-bezier(0, 0, 0.2, 1)'
              : 'opacity 120ms cubic-bezier(0.4, 0, 1, 1)',
          }}
        >
          <FilterBar compact />
        </div>
      )}
    </header>
  )
}
