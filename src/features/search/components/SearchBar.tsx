import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { useSearch, type SearchPhase } from '../hooks/useSearch'
import { touchOpened } from '@/features/bookmarks/db'
import { useBookmarkStore } from '@/features/bookmarks'
import { Skeleton } from '@/shared/ui/Skeleton'
import { IconSearch } from '@/shared/ui/icons'
import { RainbowBorder } from './RainbowBorder'
import { SearchResult } from './SearchResult'

const EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)'
const DURATION = 400
/** 输入即搜防抖：本地索引毫秒级，250ms 仅为避免逐键重渲染 */
const PREVIEW_DEBOUNCE = 250

const PHASE_LABELS: Record<SearchPhase, string> = {
  idle: '语义搜索',
  previewing: '即时匹配',
  'ai-pending': '本地匹配 · AI 精排中…',
  'ai-done': '语义搜索',
  'local-only': '关键词搜索',
}

export function SearchBar({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [active, setActive] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [query, setQuery] = useState('')
  const [alertDismissed, setAlertDismissed] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<number | null>(null)
  const {
    history,
    results,
    phase,
    loading,
    degradedReason,
    hasQueried,
    previewLocal,
    search,
    primeIndex,
    noteResultOpened,
    reset,
    refreshHistory,
  } = useSearch()

  // useCallback 稳定引用：activate/deactivate 进键盘监听 effect 的 deps，
  // 依赖链（primeIndex/refreshHistory/reset）在 useSearch 内均为稳定 useCallback
  const clearPreviewTimer = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const activate = useCallback(() => {
    setActive(true)
    primeIndex()
    void refreshHistory()
  }, [primeIndex, refreshHistory])

  const deactivate = useCallback(() => {
    clearPreviewTimer()
    setActive(false)
    setHovered(false)
    setQuery('')
    setAlertDismissed(false)
    setSelectedIdx(-1)
    reset()
  }, [clearPreviewTimer, reset])

  const onInputChange = (value: string) => {
    setQuery(value)
    setSelectedIdx(-1) // 输入变化即将刷新结果，清空键盘选中
    clearPreviewTimer()
    debounceRef.current = window.setTimeout(() => previewLocal(value), PREVIEW_DEBOUNCE)
  }

  useEffect(() => clearPreviewTimer, [clearPreviewTimer])

  useEffect(() => {
    if (active) {
      const id = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(id)
    }
  }, [active])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        activate()
      }
      if (e.key === 'Escape' && active) {
        deactivate()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [active, activate, deactivate])

  const submit = (q: string) => {
    clearPreviewTimer()
    setQuery(q)
    setSelectedIdx(-1)
    void search(q)
  }

  const openResult = (id: string, url: string) => {
    noteResultOpened(id)
    void touchOpened(id).then(() => useBookmarkStore.getState().hydrate())
    window.open(url, '_blank', 'noopener,noreferrer')
    deactivate()
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault()
      setSelectedIdx((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault()
      setSelectedIdx((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      const picked = selectedIdx >= 0 ? results[selectedIdx] : undefined
      if (picked) openResult(picked.bookmark.id, picked.bookmark.url)
      else submit(query)
    }
  }

  const wide = active || hovered

  return (
    <>
      {/* 黑色遮罩 — 始终渲染，通过 opacity 过渡 */}
      <div
        onClick={active ? deactivate : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--mt-overlay)',
          zIndex: 200,
          opacity: active ? 1 : 0,
          pointerEvents: active ? 'auto' : 'none',
          transition: `opacity ${DURATION}ms ${EASE}`,
        }}
      />

      {/* 搜索框容器 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 24,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: active ? 250 : 100,
        }}
      >
        <div
          style={{
            position: 'relative',
            pointerEvents: 'auto',
            width: wide ? 'min(640px, 85vw)' : 'min(320px, 42vw)',
            transition: `width ${DURATION}ms ${EASE}`,
          }}
          onMouseEnter={() => { if (!active) setHovered(true) }}
          onMouseLeave={() => { if (!active) setHovered(false) }}
        >
          {/* 内容面板 — 外壳：圆角裁剪 */}
          <div
            className="glass"
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              marginBottom: 8,
              borderRadius: 'var(--mt-radius-2xl)',
              maxHeight: active ? '80vh' : 0,
              opacity: active ? 1 : 0,
              transform: active ? 'translateY(0)' : 'translateY(12px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              pointerEvents: active ? 'auto' : 'none',
              background: 'var(--mt-glass-bg-solid)',
              border: 'none',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
              transition: active ? `opacity ${DURATION}ms ${EASE}, transform ${DURATION}ms ${EASE}, max-height ${DURATION}ms ${EASE}` : 'none',
            }}
          >
            {/* 顶部标题栏 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px 12px',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--mt-text-strong)' }}>
                AI 搜索
              </span>
              <PanelCloseButton onClick={deactivate} />
            </div>

            {/* 内层：滚动容器 */}
            <div
              className="search-panel"
              style={{
                overflowY: 'auto',
                flex: 1,
                minHeight: 0,
                padding: active ? '0 20px 16px 20px' : '0 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: `padding ${DURATION}ms ${EASE}`,
              }}
            >
              {degradedReason && !alertDismissed && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: '#b45309',
                    background: 'rgba(245, 158, 11, 0.25)',
                    border: 'none',
                    borderRadius: 'var(--mt-radius-md)',
                    padding: '8px 12px',
                  }}
                >
                  {degradedReason === 'no-key' ? (
                    <span>
                      未配置 AI 服务，已用关键词匹配 ·{' '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deactivate()
                          onOpenSettings?.()
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#b45309',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'underline',
                        }}
                      >
                        去设置
                      </button>
                    </span>
                  ) : (
                    <span>
                      AI 搜索暂时不可用，当前为基础搜索模式 ·{' '}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setAlertDismissed(true)
                          submit(query)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: '#b45309',
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'underline',
                        }}
                      >
                        重试 AI 搜索
                      </button>
                    </span>
                  )}
                  <AlertCloseButton onClick={() => setAlertDismissed(true)} />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--mt-text-muted)',
                  padding: '0 8px 0 4px',
                }}
              >
                <span>{PHASE_LABELS[phase]}</span>
                {phase === 'ai-pending' && (
                  <Loader2 size={12} className="animate-spin" style={{ flexShrink: 0 }} />
                )}
              </div>

              {/* 结果区域 — 空状态 / 加载 / 搜索结果
                  loading 仅在「AI 精排中且屏上无本地结果」时为真；
                  精排等待期本地结果保持可见可点，避免整屏 Skeleton */}
              {!loading && !hasQueried && <SearchIllustration />}
              {loading && <LoadingList />}
              {!loading && hasQueried && results.length === 0 && (
                <EmptyHint text="未找到匹配内容，试试其他描述？" />
              )}
              {!loading &&
                hasQueried &&
                results.map((r, i) => (
                  <SearchResult
                    key={r.bookmark.id}
                    item={r}
                    selected={i === selectedIdx}
                    onSelect={() => openResult(r.bookmark.id, r.bookmark.url)}
                  />
                ))}

              {/* 历史搜索 — 始终在底部 */}
              {!loading && history.length > 0 && (
                <HistorySection history={history} onPick={submit} />
              )}
            </div>
          </div>

          {/* Pill 容器 — 共享外框，内部交叉淡入淡出 */}
          <div
            ref={pillRef}
            className={active ? 'glass' : 'glass search-pill-rainbow'}
            onClick={() => { if (!active) activate() }}
            style={{
              position: 'relative',
              width: '100%',
              padding: '14px 20px',
              borderRadius: 'var(--mt-radius-pill)',
              boxShadow: 'var(--mt-search-shadow)',
              cursor: active ? 'text' : 'pointer',
              border: active ? 'none' : undefined,
              background: active ? 'var(--mt-glass-bg-solid)' : 'var(--mt-search-bg)',
              transition: `background 200ms ease`,
            }}
          >
            {!active && <RainbowBorder containerRef={pillRef} hovered={hovered} />}

            {/* 按钮内容 — 非激活时显示 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: active ? 0 : 1,
                pointerEvents: active ? 'none' : 'auto',
                transition: `opacity 200ms ${EASE}`,
                color: 'var(--mt-text-muted)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <IconSearch size={16} />
                <span style={{ fontSize: 14 }}>用自然语言找回收藏…</span>
              </span>
              <kbd
                style={{
                  fontSize: 11,
                  color: 'var(--mt-text-placeholder)',
                  border: '1px solid var(--mt-border)',
                  borderRadius: 'var(--mt-radius-sm)',
                  padding: '2px 6px',
                  fontFamily: 'inherit',
                }}
              >
                ⌘K
              </kbd>
            </div>

            {/* 输入框 — 激活时显示，叠加在按钮内容之上 */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 10,
                opacity: active ? 1 : 0,
                pointerEvents: active ? 'auto' : 'none',
                transition: `opacity 200ms ${EASE} ${active ? '150ms' : '0ms'}`,
              }}
            >
              <IconSearch size={16} style={{ flexShrink: 0, color: 'var(--mt-text-muted)' }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                className="search-input"
                placeholder="用自然语言找回收藏…"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 14,
                  color: 'var(--mt-text-primary)',
                }}
              />
              {query && <InputClearButton onClick={() => { setQuery(''); reset(); inputRef.current?.focus() }} />}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function SearchIllustration() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '20px 0 12px',
    }}>
      <svg width="72" height="52" viewBox="0 0 72 52" fill="none">
        <rect x="8" y="8" width="30" height="3.5" rx="1.75" fill="var(--mt-border)" />
        <rect x="8" y="17" width="24" height="3.5" rx="1.75" fill="var(--mt-border)" />
        <rect x="8" y="26" width="27" height="3.5" rx="1.75" fill="var(--mt-border)" />
        <rect x="8" y="35" width="20" height="3.5" rx="1.75" fill="var(--mt-border)" />
        <circle cx="50" cy="25" r="11" stroke="var(--mt-border)" strokeWidth="2" />
        <line x1="58.2" y1="33.2" x2="65" y2="40" stroke="var(--mt-border)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 11, color: 'var(--mt-text-placeholder)' }}>
        用自然语言描述，找回你的收藏
      </span>
    </div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--mt-text-muted)', fontWeight: 500, padding: '0 4px' }}>历史搜索</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {history.map((q) => (
          <HistoryButton key={q} label={q} onClick={() => onPick(q)} />
        ))}
      </div>
    </div>
  )
}

function HistoryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="border transition-all cursor-pointer"
      style={{
        borderRadius: 9999,
        padding: '4px 12px',
        fontSize: 12,
        color: 'var(--mt-text-primary)',
        background: hovered ? 'var(--mt-bg-secondary)' : 'transparent',
      }}
    >
      {label}
    </button>
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

function PanelCloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
        color: hovered ? 'var(--mt-text-strong)' : 'var(--mt-text-muted)',
        transition: 'color 200ms ease',
        flexShrink: 0,
      }}
    >
      <X size={16} />
    </button>
  )
}

function AlertCloseButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        color: '#b45309',
        opacity: hovered ? 1 : 0.6,
        transition: 'opacity 200ms ease',
        flexShrink: 0,
      }}
    >
      <X size={14} />
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '24px 0',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--mt-text-muted)',
      }}
    >
      {text}
    </div>
  )
}

function InputClearButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 4,
        display: 'flex',
        alignItems: 'center',
        color: hovered ? 'var(--mt-text-strong)' : 'var(--mt-text-placeholder)',
        transition: 'color 200ms ease',
        flexShrink: 0,
      }}
    >
      <X size={14} />
    </button>
  )
}
