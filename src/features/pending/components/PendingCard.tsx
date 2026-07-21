import { useState } from 'react'
import type { IndexStatus, PendingBookmark } from '@/shared/db'
import { Favicon } from '@/shared/ui/Favicon'
import { IconCheck, IconClose, IconEdit } from '@/shared/ui/icons'
const MAX_TITLE = 20

interface Props {
  item: PendingBookmark
  onRename: (id: string, title: string) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onConfirm: (id: string) => void | Promise<void>
}

export function PendingCard({ item, onRename, onDelete, onConfirm }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)
  const submit = () => {
    const t = draft.trim().slice(0, MAX_TITLE)
    if (t && t !== item.title) onRename(item.id, t)
    setEditing(false)
  }

  return (
    <div
      className="glass glass-border"
      style={{
        borderRadius: 'var(--mt-radius-lg)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
      title="48小时后失效"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Favicon src={item.favicon} domain={item.domain} title={item.title} size={16} />

        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={MAX_TITLE}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') {
                setDraft(item.title)
                setEditing(false)
              }
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '2px 6px',
              fontSize: 14,
              border: '1px solid var(--mt-border-hover)',
              borderRadius: 'var(--mt-radius-sm)',
              background: 'var(--mt-surface-active)',
              color: 'var(--mt-text-primary)',
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              minWidth: 0,
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
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--mt-text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.domain}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <IndexBadge status={item.indexStatus} />
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn label="编辑名称" onClick={() => setEditing((v) => !v)}>
            <IconEdit size={14} />
          </IconBtn>
          <IconBtn label="确认归入收藏库" onClick={() => onConfirm(item.id)}>
            <IconCheck size={14} />
          </IconBtn>
          <IconBtn label="删除待确认" onClick={() => onDelete(item.id)}>
            <IconClose size={14} />
          </IconBtn>
        </div>
      </div>
    </div>
  )
}

function IndexBadge({ status }: { status: IndexStatus }) {
  if (status === 'done') return <span />
  const color =
    status === 'pending' ? 'var(--mt-success)' : 'var(--mt-text-placeholder)'
  return (
    <span style={{ fontSize: 11, color }}>
      {status === 'pending' ? 'AI整理中' : '索引中'}
    </span>
  )
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 'var(--mt-radius-sm)',
        color: 'var(--mt-text-secondary)',
        cursor: 'pointer',
        fontSize: 14,
        lineHeight: 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--mt-surface-hover)'
        e.currentTarget.style.borderColor = 'var(--mt-border)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {children}
    </button>
  )
}
