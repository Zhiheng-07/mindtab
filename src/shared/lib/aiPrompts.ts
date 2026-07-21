// AI prompt 构建与响应解析（纯函数，无 chrome API、无网络）。
// prompt 原文与解析逻辑逐字搬迁自 V0.1 mindtab-server/src/server.ts（原中转 relay）。

export const CONTENT_TYPES = ['文章', '视频', '工具', '文档', '其他'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 温度参数（与原 relay 一致）
export const TEMP_INDEX = 0.3
export const TEMP_SEARCH = 0.2

// ───── prompt 构建 ─────

/** 单条语义索引：根据 url/title/content 生成结构化结果 */
export function buildIndexMessages(input: {
  url: string
  title: string
  content: string
}): ChatMessage[] {
  const { url, title, content } = input
  return [
    {
      role: 'system',
      content:
        '你是 MindTab 的语义索引助手。根据用户提供的网页 URL、标题、正文，输出**仅 JSON**（不要 markdown 代码块、不要解释文字）。\n' +
        'Schema：\n' +
        '{\n' +
        '  "summary": "100字以内中文摘要",\n' +
        '  "tags": ["3~5个简洁中文标签"],\n' +
        '  "content_type": "文章" | "视频" | "工具" | "文档" | "其他",\n' +
        '  "optimized_title": "可选；若原标题为空、乱码或纯域名则提供"\n' +
        '}\n' +
        'content_type 只能是 5 个值之一。若正文极短或缺失，根据 URL 与标题尽力推断。',
    },
    {
      role: 'user',
      content: `URL: ${url}\n标题: ${title ?? ''}\n正文片段:\n${(content ?? '').slice(0, 4000)}`,
    },
  ]
}

/** 批量语义索引：一次调用处理多条书签（最多 5 条） */
export function buildBatchIndexMessages(
  items: { url: string; title: string; content: string }[],
): ChatMessage[] {
  const batch = items.slice(0, 5) // 单次最多 5 条
  const userLines = batch
    .map(
      (it, i) =>
        `[${i}] URL: ${it.url ?? ''}\n标题: ${it.title ?? ''}\n正文片段:\n${(it.content ?? '').slice(0, 2000)}`,
    )
    .join('\n---\n')

  return [
    {
      role: 'system',
      content:
        '你是 MindTab 的语义索引助手。用户将提供多条网页信息（以 [序号] 分隔），请为每条分别生成结构化结果。\n' +
        '输出**仅 JSON 数组**（不要 markdown 代码块、不要解释文字）。\n' +
        '每条格式：\n' +
        '{\n' +
        '  "i": 序号,\n' +
        '  "summary": "100字以内中文摘要",\n' +
        '  "tags": ["3~5个简洁中文标签"],\n' +
        '  "content_type": "文章" | "视频" | "工具" | "文档" | "其他",\n' +
        '  "optimized_title": "可选；若原标题为空、乱码或纯域名则提供"\n' +
        '}\n' +
        'content_type 只能是 5 个值之一。若正文极短或缺失，根据 URL 与标题尽力推断。数组长度必须等于输入条数。',
    },
    { role: 'user', content: userLines },
  ]
}

/** 自然语言召回：从候选书签里挑相关项 */
export function buildSearchMessages(
  query: string,
  bookmarks: { id: string; title: string; domain: string; summary: string; tags: string[] }[],
): ChatMessage[] {
  // token 保护：候选书签超过 500 条时截取前 500 条。
  // 原中转时代由服务端限流兜底；现在用户自付费直连，避免超大 prompt 烧钱/超上下文。
  const candidates = bookmarks.length > 500 ? bookmarks.slice(0, 500) : bookmarks
  return [
    {
      role: 'system',
      content:
        '你是 MindTab 的语义召回助手。根据用户的自然语言查询，从候选书签里挑出最多 5 条相关项，按相关度倒序返回**仅 JSON**：\n' +
        '{"results": [{"id": "书签ID", "score": 0~1, "reason": "20字内匹配理由"}]}\n' +
        '相关度 < 0.3 的不要返回。',
    },
    {
      role: 'user',
      content: `查询: ${query}\n候选书签: ${JSON.stringify(candidates)}`,
    },
  ]
}

// ───── 响应解析 ─────

export function stripCodeFence(s: string): string {
  const t = s.trim()
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return m ? m[1].trim() : t
}

export function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(stripCodeFence(s)) as T
  } catch {
    return fallback
  }
}

export interface ParsedIndexResult {
  summary: string
  tags: string[]
  contentType: ContentType
  optimizedTitle?: string
}

export interface ParsedBatchItemResult extends ParsedIndexResult {
  index: number
}

export interface ParsedSearchHit {
  id: string
  score: number
  reason: string
}

/** 单条索引响应：snake→camel、裁剪、contentType 兜底'其他' */
export function parseIndexResponse(raw: string): ParsedIndexResult {
  const obj = safeJsonParse<Record<string, unknown>>(raw, {})
  const ct = String(obj.content_type ?? '其他') as ContentType
  return {
    summary: String(obj.summary ?? '').slice(0, 100),
    tags: Array.isArray(obj.tags)
      ? obj.tags.slice(0, 5).map((t) => String(t).slice(0, 16))
      : [],
    contentType: (CONTENT_TYPES as readonly string[]).includes(ct) ? ct : '其他',
    optimizedTitle: obj.optimized_title
      ? String(obj.optimized_title).slice(0, 60)
      : undefined,
  }
}

/** 批量索引响应：index 取模型返回的 obj.i，非 number 时用数组下标兜底 */
export function parseBatchResponse(raw: string): ParsedBatchItemResult[] {
  const arr = safeJsonParse<unknown[]>(raw, [])
  if (!Array.isArray(arr)) return []
  return arr.map((item, fallbackIdx) => {
    const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const ct = String(obj.content_type ?? '其他') as ContentType
    return {
      index: typeof obj.i === 'number' ? obj.i : fallbackIdx,
      summary: String(obj.summary ?? '').slice(0, 100),
      tags: Array.isArray(obj.tags)
        ? obj.tags.slice(0, 5).map((t) => String(t).slice(0, 16))
        : [],
      contentType: (CONTENT_TYPES as readonly string[]).includes(ct) ? ct : '其他',
      optimizedTitle: obj.optimized_title
        ? String(obj.optimized_title).slice(0, 60)
        : undefined,
    }
  })
}

/** 搜索召回响应：校验 {results:[{id,score,reason}]} 形状，兜底 [] */
export function parseSearchResponse(raw: string): ParsedSearchHit[] {
  const obj = safeJsonParse<{ results?: unknown }>(raw, { results: [] })
  if (!Array.isArray(obj.results)) return []
  const hits: ParsedSearchHit[] = []
  for (const item of obj.results) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.id !== 'string') continue
    hits.push({
      id: r.id,
      score: typeof r.score === 'number' ? r.score : 0,
      reason: String(r.reason ?? ''),
    })
  }
  return hits
}
