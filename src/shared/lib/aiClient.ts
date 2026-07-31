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
      const errorMessage = classifyApiError(res.status, text, draft.model)
      return { ok: false, error: errorMessage }
    }
    return { ok: true }
  } catch (e) {
    const msg = (e as Error).message
    if ((e as Error).name === 'AbortError') {
      return { ok: false, error: '连接超时，请检查网络或填写正确的 Base URL' }
    }
    // TypeError 通常是 fetch 失败（DNS/断网/CORS）
    if (e instanceof TypeError) {
      return { ok: false, error: `网络请求失败：${msg}` }
    }
    return { ok: false, error: msg }
  }
}

/**
 * 将 HTTP 错误分类为对用户友好的语义化消息。
 */
function classifyApiError(status: number, body: string, model: string): string {
  const lower = body.toLowerCase()

  if (status === 401) {
    return 'API Key 无效或已过期，请检查后重试'
  }
  if (status === 403) {
    return '没有访问权限，该 API Key 可能不支持此接口'
  }
  if (status === 404) {
    return `接口地址（endpoint）不存在，请检查 Base URL 是否正确`
  }
  if (status === 429) {
    return '请求过于频繁，请稍后再试'
  }

  // 400/422 — 检查是否是模型名称问题
  if (status === 400 || status === 422) {
    if (
      lower.includes('model') &&
      (lower.includes('not found') ||
        lower.includes('not exist') ||
        lower.includes('invalid') ||
        lower.includes('does not exist') ||
        lower.includes('unsupported') ||
        lower.includes('not support') ||
        lower.includes('不存在') ||
        lower.includes('不支持'))
    ) {
      return `模型名称 "${model}" 无效，请确认该模型在目标 API 中可用`
    }
    if (lower.includes('api key') || lower.includes('apikey') || lower.includes('authentication')) {
      return 'API Key 无效或已过期'
    }
  }

  // 500+
  if (status >= 500) {
    return `服务端错误 (${status})，请稍后重试或联系 API 服务商`
  }

  // 通用回退
  const snippet = body.slice(0, 120).replace(/\s+/g, ' ').trim()
  return snippet ? `${status}: ${snippet}` : `请求失败 (HTTP ${status})`
}

interface ModelListResponse {
  data?: { id: string }[]
}

/**
 * 拉取 OpenAI 兼容厂商的可用模型列表：GET /v1/models。
 * 接收**未保存的草稿配置**（不读 storage），15s 超时。
 *
 * 返回模型 id 数组（按字母排序）。
 * 任何失败 throw Error（含语义化错误），由 UI 捕获后回退到手动输入。
 */
export async function fetchModels(draft: AiConfig): Promise<string[]> {
  const baseUrl = draft.baseUrl.trim().replace(/\/+$/, '')
  // resolveChatUrl 拿的是 chat/completions 路径，模型列表需要 /models
  const modelsUrl = baseUrl.includes('/chat/completions')
    ? baseUrl.replace(/\/chat\/completions$/, '/models')
    : baseUrl.endsWith('/v1')
      ? `${baseUrl}/models`
      : `${baseUrl}/models`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(modelsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${draft.apiKey}`,
      },
      signal: ctrl.signal,
    })
    if (!res.ok) {
      // 部分厂商（如豆包/阶跃）不提供 /models 接口 → 引导手动输入
      if (res.status === 404) {
        throw new Error('该服务商不支持在线获取模型列表，请手动输入模型名')
      }
      const text = await res.text().catch(() => '')
      throw new Error(classifyApiError(res.status, text, ''))
    }
    const data = (await res.json()) as ModelListResponse
    if (!data?.data || !Array.isArray(data.data)) {
      throw new Error('服务器返回的模型列表格式无效')
    }
    return data.data.map((m) => m.id).sort()
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('拉取模型列表超时，请检查网络或 Base URL', { cause: e })
    }
    throw e
  } finally {
    clearTimeout(timer)
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
