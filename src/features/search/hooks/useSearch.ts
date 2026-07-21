import { useCallback, useEffect, useState } from 'react'
import { searchBookmarks } from '@/shared/lib/api'
import { AiNotConfiguredError } from '@/shared/lib/aiClient'
import { isAiConfigured } from '@/shared/lib/aiProvider'
import { type Bookmark } from '@/shared/db'
import { getAllBookmarks } from '@/features/bookmarks/db'
import { getSearchHistory, pushSearchHistory } from '../storage'

export type SearchMode = 'ai' | 'keyword'

/** 降级原因：'no-key' = 未配置 AI；'ai-error' = AI 调用失败；null = 未降级 */
export type DegradedReason = 'no-key' | 'ai-error' | null

export interface SearchResultItem {
  bookmark: Bookmark
  score: number
  reason: string
}

export interface UseSearchReturn {
  history: string[]
  results: SearchResultItem[]
  loading: boolean
  mode: SearchMode
  /** AI 不可用时，本次搜索降级到关键词模式的原因（null = 未降级） */
  degradedReason: DegradedReason
  /** 是否已查询过（控制空态/历史显示）*/
  hasQueried: boolean
  search: (query: string) => Promise<void>
  reset: () => void
  refreshHistory: () => Promise<void>
}

export function useSearch(): UseSearchReturn {
  const [history, setHistory] = useState<string[]>([])
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [degradedReason, setDegradedReason] = useState<DegradedReason>(null)
  const [mode, setMode] = useState<SearchMode>('ai')
  const [hasQueried, setHasQueried] = useState(false)

  const refreshHistory = useCallback(async () => {
    setHistory(await getSearchHistory())
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const reset = useCallback(() => {
    setResults([])
    setHasQueried(false)
    setDegradedReason(null)
    setMode('ai')
  }, [])

  const search = useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim()
    if (!query) return

    setLoading(true)
    setHasQueried(true)
    setDegradedReason(null)
    try {
      const bookmarks = await getAllBookmarks()

      // 未配置 AI → 不发请求，直接关键词模式
      let usedMode: SearchMode = 'ai'
      let reason: DegradedReason = null
      if (!(await isAiConfigured())) {
        usedMode = 'keyword'
        reason = 'no-key'
      }

      let hits: SearchResultItem[] = []

      if (usedMode === 'ai') {
        try {
          const payload = bookmarks.map((b) => ({
            id: b.id,
            title: b.title,
            domain: b.domain,
            summary: b.summary,
            tags: b.tags,
          }))
          const aiHits = await searchBookmarks(query, payload)
          hits = aiHits
            .filter((h) => h.score >= 0.3)
            .map((h) => {
              const b = bookmarks.find((x) => x.id === h.id)
              return b ? { bookmark: b, score: h.score, reason: h.reason } : null
            })
            .filter((x): x is SearchResultItem => x !== null)
            .slice(0, 5)
        } catch (e) {
          console.warn('[MindTab] AI search failed, fallback to keyword:', (e as Error).message)
          reason = e instanceof AiNotConfiguredError ? 'no-key' : 'ai-error'
          usedMode = 'keyword'
        }
      }

      if (usedMode === 'keyword') {
        hits = keywordSearch(query, bookmarks)
      }

      setMode(usedMode)
      setDegradedReason(reason)
      setResults(hits)
      await pushSearchHistory(query)
      await refreshHistory()
    } finally {
      setLoading(false)
    }
  }, [refreshHistory])

  return {
    history,
    results,
    loading,
    mode,
    degradedReason,
    hasQueried,
    search,
    reset,
    refreshHistory,
  }
}

// ───── 关键词降级 ─────

function keywordSearch(query: string, bookmarks: Bookmark[]): SearchResultItem[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (tokens.length === 0) return []

  const scored = bookmarks.map((b) => {
    const haystack = [
      b.title,
      b.domain,
      b.summary,
      b.tags.join(' '),
      b.contentType,
    ]
      .join(' ')
      .toLowerCase()
    let score = 0
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1
    }
    return { bookmark: b, score, reason: '关键词匹配' }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((s) => ({ ...s, score: s.score / tokens.length }))
}
