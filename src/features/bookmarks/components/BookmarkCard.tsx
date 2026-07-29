import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Bookmark } from '@/shared/db'
import { useAiConfigured } from '@/shared/lib/aiStatus'
import { formatRelativeTime } from '@/shared/lib/timeFormat'
import { ContextMenu, type ContextMenuItem } from '@/shared/ui/ContextMenu'
import { Favicon } from '@/shared/ui/Favicon'

const HOVER_DELAY = 300
const SUMMARY_MAX = 100

interface Props {
  item: Bookmark
  onOpen: (item: Bookmark) => void
  onTogglePin: (id: string) => void
  onDelete: (id: string) => void
}

export function BookmarkCard({ item, onOpen, onTogglePin, onDelete }: Props) {
  const aiConfigured = useAiConfigured()
  const [hovered, setHovered] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const summaryRef = useRef<HTMLDivElement>(null)
  const [summaryNaturalH, setSummaryNaturalH] = useState(0)
  const tagsOuterRef = useRef<HTMLDivElement>(null)
  const tagsInnerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!item.tags.length) return
    const outer = tagsOuterRef.current
    const inner = tagsInnerRef.current
    if (!outer || !inner) return

    let lastY = window.scrollY
    const update = () => {
      const overflow = inner.scrollWidth - outer.clientWidth
      if (overflow <= 0) return
      const y = window.scrollY
      const down = y > lastY
      lastY = y
      inner.style.transform = down ? `translateX(${-overflow}px)` : 'translateX(0)'
    }

    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [item.tags])

  const enter = () => {
    setHovered(true)
    if (!item.summary) return
    hoverTimer.current = setTimeout(() => setShowSummary(true), HOVER_DELAY) as unknown as number
  }
  const leave = () => {
    setHovered(false)
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowSummary(false)
  }

  // Measure summary natural height (scrollHeight ignores maxHeight: 0)
  useLayoutEffect(() => {
    if (summaryRef.current) {
      setSummaryNaturalH(summaryRef.current.scrollHeight)
    }
  }, [item.summary])

  const menuItems: ContextMenuItem[] = [
    {
      key: 'pin',
      label: '置顶',
      onSelect: () => onTogglePin(item.id),
    },
    { key: 'del', label: '删除', danger: true, onSelect: () => onDelete(item.id) },
  ]

  const summary =
    item.summary.length > SUMMARY_MAX
      ? item.summary.slice(0, SUMMARY_MAX) + '…'
      : item.summary

  // Negative margin = card's growth contribution to grid (summary height + flex gap)
  const compensateH = showSummary && summary && summaryNaturalH > 0 ? summaryNaturalH + 10 : 0

  return (
    <>
      <article
        onClick={() => onOpen(item)}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className="glass glass-border"
        style={{
          position: 'relative',
          zIndex: hovered ? 10 : 1,
          borderRadius: 22,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          cursor: 'pointer',
          minHeight: 149,
          marginBottom: compensateH > 0 ? -compensateH : undefined,
          transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
          background: hovered ? 'var(--mt-glass-bg-hover)' : undefined,
          boxShadow: hovered
            ? 'var(--mt-shadow-hover)'
            : 'var(--mt-glass-shadow)',
          borderColor: hovered ? 'var(--mt-border-hover)' : undefined,
          transition:
            'transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1), border-color 280ms cubic-bezier(0.4, 0, 0.2, 1), background 280ms cubic-bezier(0.4, 0, 0.2, 1), margin-bottom 280ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Row 1: Favicon + timestamp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Favicon src={item.favicon} domain={item.domain} title={item.title} size={24} />
          <span style={{ fontSize: 11, color: 'var(--mt-text-placeholder)' }}>
            {formatRelativeTime(item.lastOpenedAt)}
          </span>
        </div>

        {/* Row 2: Title */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--mt-text-strong)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title || item.domain}
        </span>

        {/* Row 3: Domain — 紧跟标题，缩小间距 */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--mt-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: -8,
          }}
        >
          {item.domain}
        </div>

        {/* Row 4: Tags — 滚动驱动横向轮播 */}
        {item.tags.length > 0 && (
          <div ref={tagsOuterRef} style={{ overflow: 'hidden', marginTop: 10 }}>
            <div
              ref={tagsInnerRef}
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                gap: 6,
                willChange: 'transform',
                transition: 'transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)',
              }}
            >
              {item.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    background: 'var(--mt-tag-bg)',
                    color: 'var(--mt-tag-text)',
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 'var(--mt-radius-sm)',
                    border: '1px solid var(--mt-tag-border)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Row 5: Summary — smoothly expands inside the card */}
        <div
          ref={summaryRef}
          style={{
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--mt-text-secondary)',
            opacity: showSummary && summary ? 1 : 0,
            maxHeight: showSummary && summary ? summaryNaturalH : 0,
            overflow: 'hidden',
            // counter flex gap when collapsed so card has no extra space
            marginTop: showSummary && summary ? 0 : -10,
            transition:
              'opacity 280ms cubic-bezier(0.4, 0, 0.2, 1), max-height 280ms cubic-bezier(0.4, 0, 0.2, 1), margin-top 280ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {summary}
        </div>

        {item.indexStatus !== 'done' && (
          <span
            style={{
              position: 'absolute',
              bottom: 10,
              right: 14,
              fontSize: 11,
              color: aiConfigured
                ? item.indexStatus === 'pending'
                  ? 'var(--mt-success)'
                  : 'var(--mt-text-placeholder)'
                : 'var(--mt-text-placeholder)',
            }}
          >
            {aiConfigured ? 'AI整理中' : '未配置AI'}
          </span>
        )}
      </article>

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
