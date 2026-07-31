// 本地搜索索引：MiniSearch 倒排索引 + 中文分词（Intl.Segmenter + bigram 双通道）。
// 两个职责：
//   1. localSearch  — 即时本地搜索（输入中预览、AI 降级兜底）
//   2. buildCandidates — 为 LLM 精排粗筛候选集（把 prompt 从全量书签压到 top N）
// 纯计算模块，无 chrome API、无网络；候选源设计为可并联（未来向量召回作为第二路加入）。

import MiniSearch, { type SearchResult as MiniSearchHit } from 'minisearch'
import { type Bookmark } from '@/shared/db'

/** 粗筛候选上限：50 条紧凑行 ≈ 3k token，远大于最终返回的 5 条，精排余量充足 */
export const CANDIDATE_LIMIT = 50

const LATIN_RE = /^[a-z0-9]+$/

// CJK 统一表意文字（基本区 + 扩展 A）
const RUN_RE = /([a-z0-9]+)|([一-鿿㐀-䶿]+)/g

const segmenter: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('zh', { granularity: 'word' })
    : null

/**
 * 分词：拉丁/数字连续段整词；CJK 段同时产出 Segmenter 词与 bigram。
 * 词与 bigram 双通道并存——Segmenter 分错词时 bigram 仍能命中（"动画视频"→ 动画/视频 + 动画/画视/视频）。
 * 索引与查询共用同一分词器，保证 token 空间一致。
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = []
  for (const run of text.toLowerCase().matchAll(RUN_RE)) {
    if (run[1]) {
      tokens.push(run[1])
      continue
    }
    const cjk = run[2]!
    if (segmenter) {
      for (const seg of segmenter.segment(cjk)) {
        const w = seg.segment
        if (w.length > 1) tokens.push(w)
      }
    }
    if (cjk.length === 1) {
      tokens.push(cjk)
    } else {
      for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk.slice(i, i + 2))
    }
  }
  return tokens
}

export interface LocalHit {
  bookmark: Bookmark
  /** 归一化到 0~1（相对本次结果最高分） */
  score: number
  reason: string
}

/** 本地排序增强（frecency / adaptive history），由调用方异步加载后传入 */
export interface RankBoost {
  /** bookmarkId → 有效 frecency 分（已按当前时间衰减） */
  frecency?: Map<string, number>
  /** 同查询词上次选中的书签 id，无条件置顶 */
  pinnedId?: string
}

export interface LocalSearchIndex {
  mini: MiniSearch
  byId: Map<string, Bookmark>
  size: number
}

/** 从全量书签构建内存索引（几千条 <100ms）；书签集合变化后需重建 */
export function createSearchIndex(bookmarks: Bookmark[]): LocalSearchIndex {
  const mini = new MiniSearch({
    fields: ['title', 'tags', 'summary', 'domain'],
    extractField: (doc, fieldName) => {
      const b = doc as unknown as Bookmark
      if (fieldName === 'tags') return b.tags.join(' ')
      return String((b as unknown as Record<string, unknown>)[fieldName] ?? '')
    },
    tokenize,
    searchOptions: {
      boost: { title: 4, tags: 3, summary: 2, domain: 1 },
      prefix: true,
      // 模糊匹配只给较长的拉丁词（容错拼写）；CJK bigram 上开 fuzzy 会引入大量噪声
      fuzzy: (term) => (LATIN_RE.test(term) && term.length > 3 ? 0.2 : false),
    },
  })
  mini.addAll(bookmarks)
  return { mini, byId: new Map(bookmarks.map((b) => [b.id, b])), size: bookmarks.length }
}

function rankedHits(index: LocalSearchIndex, query: string): MiniSearchHit[] {
  const q = query.trim()
  if (!q) return []
  return index.mini.search(q)
}

/** 本地即时搜索：字段加权 × frecency + 同分按新近度 + adaptive 置顶，返回 top limit */
export function localSearch(
  index: LocalSearchIndex,
  query: string,
  limit = 5,
  boost?: RankBoost,
): LocalHit[] {
  const pinned = boost?.pinnedId ? index.byId.get(boost.pinnedId) : undefined
  const hits = rankedHits(index, query)
  if (hits.length === 0 && !pinned) return []

  const scored = hits
    .map((h) => {
      const bookmark = index.byId.get(String(h.id))
      if (!bookmark) return null
      // frecency 乘法加成：常用书签排前，封顶避免高频项永远霸榜
      const f = boost?.frecency?.get(bookmark.id) ?? 0
      return { bookmark, raw: h.score * (1 + 0.15 * Math.min(f, 8)) }
    })
    .filter((h): h is { bookmark: Bookmark; raw: number } => h !== null)
    .filter((h) => h.bookmark.id !== pinned?.id)
    .sort(
      (a, b) =>
        b.raw - a.raw ||
        Math.max(b.bookmark.lastOpenedAt, b.bookmark.createdAt) -
          Math.max(a.bookmark.lastOpenedAt, a.bookmark.createdAt),
    )

  const top = scored[0]?.raw || 1
  const out: LocalHit[] = scored
    .slice(0, pinned ? limit - 1 : limit)
    .map((h) => ({ bookmark: h.bookmark, score: h.raw / top, reason: '关键词匹配' }))
  if (pinned) out.unshift({ bookmark: pinned, score: 1, reason: '上次的选择' })
  return out
}

/**
 * LLM 精排候选粗筛：
 * - 书签 ≤ N：全量直传，零质量回退
 * - 否则：字面命中 top N；命中不足的缺口按「最近打开/最近收藏」补满——
 *   覆盖「上次看的那个…」类与书签文本零字面重叠的查询
 */
export function buildCandidates(
  index: LocalSearchIndex,
  query: string,
  allBookmarks: Bookmark[],
  n = CANDIDATE_LIMIT,
): Bookmark[] {
  if (allBookmarks.length <= n) return allBookmarks

  const picked: Bookmark[] = []
  const seen = new Set<string>()
  for (const h of rankedHits(index, query)) {
    if (picked.length >= n) break
    const b = index.byId.get(String(h.id))
    if (b && !seen.has(b.id)) {
      picked.push(b)
      seen.add(b.id)
    }
  }
  if (picked.length < n) {
    const rest = allBookmarks
      .filter((b) => !seen.has(b.id))
      .sort(
        (a, b) =>
          Math.max(b.lastOpenedAt, b.createdAt) - Math.max(a.lastOpenedAt, a.createdAt),
      )
    picked.push(...rest.slice(0, n - picked.length))
  }
  return picked
}
