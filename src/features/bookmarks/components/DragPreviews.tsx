// 拖拽浮层预览（从 App.tsx 提取）。
// PinnedDragPreview：置顶行的圆形图标预览。
// DragPreview：网格卡片 ↔ 接近文件夹时变形为圆形图标。

import type { Bookmark } from '@/shared/db'
import { Favicon } from '@/shared/ui/Favicon'

/* ── 置顶行拖拽预览：保持圆形图标原样 ── */
export function PinnedDragPreview({ item }: { item: Bookmark }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        width: 72,
        cursor: 'grabbing',
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
          background: 'var(--mt-glass-bg)',
          backdropFilter: 'var(--mt-glass-blur)',
          WebkitBackdropFilter: 'var(--mt-glass-blur)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
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
          textAlign: 'center',
        }}
      >
        {item.title || item.domain}
      </span>
    </div>
  )
}

/* ── 拖拽预览：卡片 ↔ 图标变形 ── */
const MORPH_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)' // expo-out — 快起慢收

export function DragPreview({ item, morphed }: { item: Bookmark; morphed: boolean }) {
  return (
    <div
      style={{
        width: morphed ? 44 : 240,
        height: morphed ? 44 : 92,
        borderRadius: morphed ? '50%' : 16,
        position: 'relative',
        overflow: 'hidden',
        cursor: 'grabbing',
        boxShadow: morphed
          ? '0 4px 16px rgba(0,0,0,0.2)'
          : '0 8px 32px rgba(0,0,0,0.12)',
        transition: [
          `width 260ms ${MORPH_EASE}`,
          `height 260ms ${MORPH_EASE}`,
          `border-radius 260ms ${MORPH_EASE}`,
          `box-shadow 260ms ${MORPH_EASE}`,
        ].join(', '),
      }}
    >
      {/* 卡片层 — 正常拖拽时可见 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--mt-glass-bg)',
          backdropFilter: 'var(--mt-glass-blur)',
          WebkitBackdropFilter: 'var(--mt-glass-blur)',
          border: '1px solid var(--mt-border)',
          borderRadius: 'inherit',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          opacity: morphed ? 0 : 1,
          pointerEvents: 'none',
          transition: `opacity ${morphed ? '100ms' : '200ms'} ${MORPH_EASE}`,
        }}
      >
        <Favicon src={item.favicon} domain={item.domain} title={item.title} size={22} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--mt-text-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title || item.domain}
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--mt-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.domain}
        </span>
      </div>

      {/* 图标层 — 接近文件夹时渐显 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--mt-glass-bg-hover)',
          backdropFilter: 'var(--mt-glass-blur)',
          WebkitBackdropFilter: 'var(--mt-glass-blur)',
          border: '1px solid var(--mt-border-hover)',
          borderRadius: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: morphed ? 1 : 0,
          pointerEvents: 'none',
          transition: `opacity ${morphed ? '260ms' : '100ms'} ${MORPH_EASE}`,
        }}
      >
        <Favicon src={item.favicon} domain={item.domain} title={item.title} size={28} rounded />
      </div>
    </div>
  )
}
