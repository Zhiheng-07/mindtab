import { useState } from 'react'
import type { SearchResultItem } from '../hooks/useSearch'
import { Favicon } from '@/shared/ui/Favicon'

interface Props {
  item: SearchResultItem
  onSelect: () => void
  /** 键盘 ↑↓ 选中态，与 hover 同款视觉 */
  selected?: boolean
}

export function SearchResult({ item, onSelect, selected = false }: Props) {
  const { bookmark: b, reason } = item
  const [hovered, setHovered] = useState(false)
  const hot = hovered || selected

  return (
    <button
      onClick={onSelect}
      className="glass-border"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        borderRadius: 'var(--mt-radius-lg)',
        padding: '12px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        borderColor: hot ? 'var(--mt-border-hover)' : undefined,
        boxShadow: hot ? 'var(--mt-search-result-shadow)' : 'none',
        background: hot ? 'var(--mt-search-result-bg-hover)' : 'var(--mt-search-result-bg)',
        backdropFilter: hot ? 'blur(7px) saturate(1.4)' : 'none',
        transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease, backdrop-filter 150ms ease',
      }}
    >
      <span style={{ marginTop: 1 }}>
        <Favicon src={b.favicon} domain={b.domain} title={b.title || ''} size={24} />
      </span>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--mt-text-strong)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {b.title || b.domain}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--mt-text-placeholder)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {b.domain}
          </div>
        </div>
        {b.summary && (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--mt-text-placeholder)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {b.summary}
          </p>
        )}
        {reason && (
          <span
            style={{
              fontSize: 12,
              color: 'var(--mt-text-strong)',
              marginTop: 4,
            }}
          >
            匹配理由：{reason}
          </span>
        )}
      </div>
    </button>
  )
}
