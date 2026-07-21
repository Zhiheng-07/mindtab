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
} from './aiPrompts'

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

export async function searchBookmarks(
  query: string,
  bookmarks: { id: string; title: string; domain: string; summary: string; tags: string[] }[],
): Promise<SearchHit[]> {
  const raw = await chatComplete({
    messages: buildSearchMessages(query, bookmarks),
    temperature: TEMP_SEARCH,
  })
  return parseSearchResponse(raw)
}
