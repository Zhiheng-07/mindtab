import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useSearch } from '../hooks/useSearch'
import { touchOpened } from '@/features/bookmarks/db'
import { useBookmarkStore } from '@/features/bookmarks'
import { Skeleton } from '@/shared/ui/Skeleton'
import { SearchResult } from './SearchResult'

interface Props {
  open: boolean
  onClose: () => void
  /** 「去设置」入口：由组装层（newtab/App.tsx）接线到 SettingsModal 的打开 state */
  onOpenSettings?: () => void
}

export function SearchModal({ open, onClose, onOpenSettings }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const {
    history,
    results,
    loading,
    mode,
    degradedReason,
    hasQueried,
    search,
    reset,
    refreshHistory,
  } = useSearch()

  useEffect(() => {
    if (open) {
      void refreshHistory()
      // motion 动画后再聚焦
      const id = setTimeout(() => inputRef.current?.focus(), 220)
      return () => clearTimeout(id)
    } else {
      setQuery('')
      reset()
    }
  }, [open, refreshHistory, reset])

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  const submit = (q: string) => {
    setQuery(q)
    void search(q)
  }

  const openResult = (id: string, url: string) => {
    void touchOpened(id).then(() => useBookmarkStore.getState().hydrate())
    window.open(url, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          onMouseDown={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--mt-overlay)',
            zIndex: 250,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <motion.div
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass-solid glass-border"
            style={{
              width: '100%',
              maxWidth: 720,
              maxHeight: '70vh',
              borderTopLeftRadius: 'var(--mt-radius-3xl)',
              borderTopRightRadius: 'var(--mt-radius-3xl)',
              borderBottom: 'none',
              padding: '20px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflow: 'hidden',
            }}
          >
            {degradedReason && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--mt-warning)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid var(--mt-warning)',
                  borderRadius: 'var(--mt-radius-md)',
                  padding: '8px 12px',
                }}
              >
                {degradedReason === 'no-key' ? (
                  <>
                    未配置 AI 服务，已用关键词匹配 ·{' '}
                    <button
                      onClick={() => {
                        onClose()
                        onOpenSettings?.()
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--mt-warning)',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'underline',
                      }}
                    >
                      去设置
                    </button>
                  </>
                ) : (
                  'AI 暂不可用，已切换关键词搜索'
                )}
              </div>
            )}

            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(query)
              }}
              placeholder="用自然语言描述想找的内容…"
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 15,
                background: 'var(--mt-surface-active)',
                color: 'var(--mt-text-primary)',
                border: '1px solid var(--mt-border)',
                borderRadius: 'var(--mt-radius-xl)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--mt-accent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--mt-border)'
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: 'var(--mt-text-placeholder)',
              }}
            >
              <span>{mode === 'ai' ? '语义搜索' : '关键词搜索'}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading && <LoadingList />}
              {!loading && !hasQueried && history.length > 0 && (
                <HistorySection history={history} onPick={submit} />
              )}
              {!loading && !hasQueried && history.length === 0 && (
                <EmptyHint text="试试搜索 “昨天看的设计文章” 或 “tailwind 教程”" />
              )}
              {!loading && hasQueried && results.length === 0 && (
                <EmptyHint text="未找到匹配内容，试试其他描述？" />
              )}
              {!loading && hasQueried &&
                results.map((r) => (
                  <SearchResult
                    key={r.bookmark.id}
                    item={r}
                    onSelect={() => openResult(r.bookmark.id, r.bookmark.url)}
                  />
                ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function HistorySection({
  history,
  onPick,
}: {
  history: string[]
  onPick: (q: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--mt-text-placeholder)' }}>历史搜索</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {history.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            style={{
              background: 'transparent',
              border: '1px solid var(--mt-border)',
              borderRadius: 'var(--mt-radius-pill)',
              padding: '4px 12px',
              fontSize: 12,
              color: 'var(--mt-text-secondary)',
              cursor: 'pointer',
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

function LoadingList() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--mt-border)',
            borderRadius: 'var(--mt-radius-md)',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Skeleton width="50%" height={14} />
          <Skeleton width="30%" height={11} />
          <Skeleton width="80%" height={13} />
        </div>
      ))}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '32px 0',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--mt-text-muted)',
      }}
    >
      {text}
    </div>
  )
}
