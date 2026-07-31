import { useCallback, useEffect, useRef, useState } from 'react'
import { searchBookmarks, type SearchCandidate } from '@/shared/lib/api'
import { AiNotConfiguredError } from '@/shared/lib/aiClient'
import { isAiConfigured } from '@/shared/lib/aiProvider'
import { type Bookmark } from '@/shared/db'
import { getAllBookmarks } from '@/features/bookmarks/db'
import { getSearchHistory, pushSearchHistory } from '../storage'
import {
  createSearchIndex,
  localSearch,
  buildCandidates,
  type LocalSearchIndex,
  type RankBoost,
} from '../lib/localIndex'
import {
  bumpFrecency,
  getFrecencyScores,
  getAdaptiveChoices,
  recordAdaptiveChoice,
  normalizeQuery,
} from '../lib/frecency'

/** 降级原因：'no-key' = 未配置 AI；'ai-error' = AI 调用失败；null = 未降级 */
export type DegradedReason = 'no-key' | 'ai-error' | null

/**
 * 两阶段搜索状态：
 * idle       — 未搜索
 * previewing — 输入中，本地即时结果
 * ai-pending — 已提交，本地结果在屏，AI 精排进行中
 * ai-done    — AI 精排结果已上屏
 * local-only — 本次以本地结果收尾（未配置 AI / AI 失败 / AI 无匹配）
 */
export type SearchPhase = 'idle' | 'previewing' | 'ai-pending' | 'ai-done' | 'local-only'

export interface SearchResultItem {
  bookmark: Bookmark
  score: number
  reason: string
}

export interface UseSearchReturn {
  history: string[]
  results: SearchResultItem[]
  phase: SearchPhase
  /** 兼容字段：仅在提交后 AI 精排中且屏上无本地结果时为 true */
  loading: boolean
  /** AI 不可用时，本次搜索降级到关键词模式的原因（null = 未降级） */
  degradedReason: DegradedReason
  /** 是否已查询过（控制空态/历史显示）*/
  hasQueried: boolean
  /** 输入中即时本地搜索（调用方防抖）；不写历史、不发请求 */
  previewLocal: (query: string) => void
  /** 提交搜索：本地结果立即上屏 → AI 精排异步替换 */
  search: (query: string) => Promise<void>
  /** 预热本地索引（面板打开时调用） */
  primeIndex: () => void
  /** 记录「用户打开了某条结果」：frecency 计分 + 当前查询词的 adaptive 记忆 */
  noteResultOpened: (bookmarkId: string) => void
  reset: () => void
  refreshHistory: () => Promise<void>
}

/** 本地索引缓存时长：面板开启期间书签被后台索引更新后，最多 30s 内重建生效 */
const INDEX_TTL = 30_000

interface IndexCache {
  index: LocalSearchIndex
  bookmarks: Bookmark[]
  builtAt: number
  /** bookmarkId → 有效 frecency 分 */
  frecency: Map<string, number>
  /** normalizeQuery(查询词) → 上次选中的书签 id */
  adaptive: Map<string, string>
}

function toBoost(cache: IndexCache, query: string): RankBoost {
  return {
    frecency: cache.frecency,
    pinnedId: cache.adaptive.get(normalizeQuery(query)),
  }
}

function toCandidatePayload(candidates: Bookmark[]): SearchCandidate[] {
  const now = Date.now()
  const days = (t: number) => Math.max(0, Math.floor((now - t) / 86_400_000))
  return candidates.map((b) => ({
    id: b.id,
    title: b.title,
    domain: b.domain,
    summary: b.summary,
    tags: b.tags,
    contentType: b.contentType,
    createdDaysAgo: days(b.createdAt),
    openedDaysAgo: b.lastOpenedAt > 0 ? days(b.lastOpenedAt) : null,
  }))
}

export function useSearch(): UseSearchReturn {
  const [history, setHistory] = useState<string[]>([])
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [phase, setPhase] = useState<SearchPhase>('idle')
  const [degradedReason, setDegradedReason] = useState<DegradedReason>(null)
  const [hasQueried, setHasQueried] = useState(false)

  // 并发守卫：previewLocal / search / reset 都会推进 seq，旧的异步结果静默丢弃
  const seqRef = useRef(0)
  const indexRef = useRef<IndexCache | null>(null)
  // 最近一次搜索/预览的查询词，供 noteResultOpened 记 adaptive
  const lastQueryRef = useRef('')

  const refreshHistory = useCallback(async () => {
    setHistory(await getSearchHistory())
  }, [])

  useEffect(() => {
    void refreshHistory()
  }, [refreshHistory])

  const ensureIndex = useCallback(async (): Promise<IndexCache> => {
    const cached = indexRef.current
    if (cached && Date.now() - cached.builtAt < INDEX_TTL) return cached
    const [bookmarks, frecency, adaptive] = await Promise.all([
      getAllBookmarks(),
      getFrecencyScores(),
      getAdaptiveChoices(),
    ])
    const built: IndexCache = {
      index: createSearchIndex(bookmarks),
      bookmarks,
      builtAt: Date.now(),
      frecency,
      adaptive,
    }
    indexRef.current = built
    return built
  }, [])

  const primeIndex = useCallback(() => {
    void ensureIndex()
  }, [ensureIndex])

  const noteResultOpened = useCallback((bookmarkId: string) => {
    void bumpFrecency(bookmarkId)
    const q = lastQueryRef.current
    if (q) void recordAdaptiveChoice(q, bookmarkId)
    // 让下次面板打开时重新加载排序数据
    indexRef.current = null
  }, [])

  const reset = useCallback(() => {
    seqRef.current++
    setResults([])
    setPhase('idle')
    setHasQueried(false)
    setDegradedReason(null)
  }, [])

  const previewLocal = useCallback(
    (rawQuery: string) => {
      const query = rawQuery.trim()
      const seq = ++seqRef.current
      if (!query) {
        setResults([])
        setPhase('idle')
        setHasQueried(false)
        setDegradedReason(null)
        return
      }
      lastQueryRef.current = query
      void ensureIndex().then((cache) => {
        if (seq !== seqRef.current) return
        setResults(localSearch(cache.index, query, 5, toBoost(cache, query)))
        setPhase('previewing')
        setHasQueried(true)
        setDegradedReason(null)
      })
    },
    [ensureIndex],
  )

  const search = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim()
      if (!query) return
      const seq = ++seqRef.current
      lastQueryRef.current = query

      setHasQueried(true)
      setDegradedReason(null)

      const cache = await ensureIndex()
      const { index, bookmarks } = cache
      if (seq !== seqRef.current) return

      // 阶段一：本地结果立即上屏（AI 等待期间保持可见可点）
      const local = localSearch(index, query, 5, toBoost(cache, query))
      setResults(local)

      void pushSearchHistory(query).then(() => refreshHistory())

      if (!(await isAiConfigured())) {
        if (seq !== seqRef.current) return
        setDegradedReason('no-key')
        setPhase('local-only')
        return
      }
      if (seq !== seqRef.current) return
        setPhase('ai-pending')

      // 阶段二：粗筛候选 → LLM 精排 → 替换结果
      try {
        const candidates = buildCandidates(index, query, bookmarks)
        const aiHits = await searchBookmarks(query, toCandidatePayload(candidates))
        if (seq !== seqRef.current) return

        const refined = aiHits
          .filter((h) => h.score >= 0.3)
          .map((h) => {
            const b = index.byId.get(h.id)
            return b ? { bookmark: b, score: h.score, reason: h.reason } : null
          })
          .filter((x): x is SearchResultItem => x !== null)
          .slice(0, 5)

        if (refined.length > 0) {
          setResults(refined)
          setPhase('ai-done')
        } else if (local.length > 0) {
          // AI 无匹配但本地有结果：保留本地结果并如实标注
            setPhase('local-only')
        } else {
          setResults([])
          setPhase('ai-done')
        }
      } catch (e) {
        if (seq !== seqRef.current) return
        console.warn('[MindTab] AI search failed, fallback to local:', (e as Error).message)
        setDegradedReason(e instanceof AiNotConfiguredError ? 'no-key' : 'ai-error')
        setPhase('local-only')
      }
    },
    [ensureIndex, refreshHistory],
  )

  return {
    history,
    results,
    phase,
    loading: phase === 'ai-pending' && results.length === 0,
    degradedReason,
    hasQueried,
    previewLocal,
    search,
    primeIndex,
    noteResultOpened,
    reset,
    refreshHistory,
  }
}
