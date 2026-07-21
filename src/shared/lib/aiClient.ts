// OpenAI 兼容 /chat/completions 直连客户端。
// 用户自填 API key（aiProvider 配置），替代原自建中转 relay。
// 上层业务封装在 api.ts（indexBookmark / indexBookmarkBatch / searchBookmarks）。

import { getAiConfig, resolveChatUrl, type AiConfig } from './aiProvider'
import type { ChatMessage } from './aiPrompts'

/** AI 未配置（无 apiKey）。aiIndex.isTransientError 据此判定为非瞬时、不退避重试。 */
export class AiNotConfiguredError extends Error {
  constructor(message = 'AI 未配置：请先在设置中填写 API Key') {
    super(message)
    this.name = 'AiNotConfiguredError'
  }
}

interface ChatCompleteArgs {
  messages: ChatMessage[]
  temperature: number
  timeoutMs?: number
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[]
}

/**
 * 发起一次 chat completion，返回首条 message.content。
 *
 * - 每次调用现读 getAiConfig()，不做模块级缓存（SW 休眠重启后拿最新配置）
 * - 默认带 response_format: json_object；若端点返回 4xx，去掉该字段重试一次
 *   （兼容不支持 response_format 的 OpenAI 兼容端点）
 * - HTTP 错误 throw `chat ${status}: ${body片段}`——「空格+三位状态码+冒号」的
 *   消息形状是契约，aiIndex.isTransientError 用 /\s(\d{3}):/ 从中抠状态码
 */
export async function chatComplete({
  messages,
  temperature,
  timeoutMs = 30_000,
}: ChatCompleteArgs): Promise<string> {
  const cfg = await getAiConfig()
  if (!cfg) throw new AiNotConfiguredError()

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature,
    response_format: { type: 'json_object' },
  }

  let res = await postChat(cfg, body, timeoutMs)
  if (!res.ok && res.status >= 400 && res.status < 500) {
    // 4xx 可能是端点不支持 response_format → 去掉重试一次
    delete body.response_format
    res = await postChat(cfg, body, timeoutMs)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`chat ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as ChatResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('chat: empty response content')
  return content
}

/**
 * 测试连通性：接收**未保存的草稿配置**（不读 storage），发最小请求。
 * 不带 response_format（只验证 key/baseUrl/model 可用，不验证 JSON 模式支持）。
 * 仅供 UI 设置页调用（需已获得目标域名 host 权限）。
 */
export async function testAiConnection(
  draft: AiConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await postChat(
      draft,
      {
        model: draft.model,
        messages: [{ role: 'user', content: '回复 OK' }],
        max_tokens: 8,
      },
      15_000,
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** 底层 POST：Bearer 鉴权 + AbortController 超时。不解析响应，由调用方处理。 */
async function postChat(
  cfg: AiConfig,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(resolveChatUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}
