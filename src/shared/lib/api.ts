// AI 业务接口封装：索引 / 批量索引 / 语义搜索。
// 自 P1 开源改造起不再走自建中转 relay，改为用户自填 API key
// 直连 OpenAI 兼容端点（aiClient.chatComplete）。
// prompt 构建与响应解析在 aiPrompts.ts（纯函数），本文件保持原有函数签名不变。

import { chatComplete } from './aiClient'
import {
  buildIndexMessages,
  buildBatchIndexMessages,
  buildSearchMessages,
  parseIndexResponse,
  parseBatchResponse,
  parseSearchResponse,
  TEMP_INDEX,
  TEMP_SEARCH,
  type SearchCandidate,
} from './aiPrompts'

export type { SearchCandidate }

export interface IndexResult {
  summary: string
  tags: string[]
  contentType: string
  optimizedTitle?: string
}

export interface BatchIndexItem {
  url: string
  title: string
  content: string
}

export interface BatchIndexResultItem extends IndexResult {
  index: number
}

export interface SearchHit {
  id: string
  score: number
  reason: string
}

export async function indexBookmark(input: {
  url: string
  title: string
  content: string
}): Promise<IndexResult> {
  const raw = await chatComplete({
    messages: buildIndexMessages(input),
    temperature: TEMP_INDEX,
  })
  return parseIndexResponse(raw)
}

/** 批量索引（最多 5 条 / 次），一次模型调用 */
export async function indexBookmarkBatch(
  items: BatchIndexItem[],
): Promise<BatchIndexResultItem[]> {
  const raw = await chatComplete({
    messages: buildBatchIndexMessages(items),
    temperature: TEMP_INDEX,
    timeoutMs: 60_000, // 批量请求给 60s 超时
  })
  return parseBatchResponse(raw)
}

/** LLM 精排：candidates 为调用方粗筛后的候选（含相对天数）。
 * prompt 内用序号指代候选，此处把模型返回的序号映射回真实书签 id。 */
export async function searchBookmarks(
  query: string,
  candidates: SearchCandidate[],
): Promise<SearchHit[]> {
  const raw = await chatComplete({
    messages: buildSearchMessages(query, candidates),
    temperature: TEMP_SEARCH,
  })
  const knownIds = new Set(candidates.map((c) => c.id))
  const hits: SearchHit[] = []
  for (const h of parseSearchResponse(raw)) {
    // 序号优先（新格式）；越界丢弃。旧 id 形状仅在确属候选集时接受
    const id =
      h.index !== undefined && h.index < candidates.length
        ? candidates[h.index].id
        : h.id !== undefined && knownIds.has(h.id)
          ? h.id
          : null
    if (id !== null) hits.push({ id, score: h.score, reason: h.reason })
  }
  return hits
}
