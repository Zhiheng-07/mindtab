// AI 厂商预设与用户配置（chrome.storage 持久化）+ host 权限辅助。
// 依赖 chrome.storage / chrome.permissions，SW 与 UI 均可用
// （ensureHostPermission 例外，见其注释）。

import { STORAGE_KEYS, get, set } from '@/shared/storage'

export type AiProviderId = 'deepseek' | 'openai' | 'kimi' | 'custom'

export interface AiProviderPreset {
  id: AiProviderId
  label: string
  baseUrl: string
  defaultModel: string
}

// 注意：defaultModel 为 2026-07 时点的常用型号，厂商可能更新换代，维护时留意。
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
  },
]

// 用户配置。预设厂商保存时也物化 baseUrl/model（读方无需查预设表），
// custom 厂商则由用户自填。
export interface AiConfig {
  provider: AiProviderId
  apiKey: string
  baseUrl: string
  model: string
}

/** 读取 AI 配置；apiKey 为空视为未配置，返回 null。每次现读 storage，不做模块级缓存。 */
export async function getAiConfig(): Promise<AiConfig | null> {
  const cfg = await get<AiConfig | null>(STORAGE_KEYS.aiConfig, null)
  if (!cfg || !cfg.apiKey || cfg.apiKey.trim() === '') return null
  return cfg
}

export async function setAiConfig(cfg: AiConfig): Promise<void> {
  await set(STORAGE_KEYS.aiConfig, cfg)
}

export async function isAiConfigured(): Promise<boolean> {
  return (await getAiConfig()) !== null
}

/**
 * 由 baseUrl 解析 /chat/completions 端点。
 * 容错：用户可能把完整端点直接填进 baseUrl。
 */
export function resolveChatUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  if (base.endsWith('/chat/completions')) return base
  return `${base}/chat/completions`
}

/** baseUrl → host 权限 origin 匹配模式，如 'https://api.deepseek.com/v1' → 'https://api.deepseek.com/*' */
export function originPatternOf(baseUrl: string): string {
  return `${new URL(baseUrl.trim()).origin}/*`
}

/** 是否已持有 baseUrl 对应域名的 host 权限。只用 contains，SW 内调用安全。 */
export async function hasHostPermission(baseUrl: string): Promise<boolean> {
  try {
    return await chrome.permissions.contains({ origins: [originPatternOf(baseUrl)] })
  } catch {
    // baseUrl 非法（URL 解析失败）等 → 视为无权限
    return false
  }
}

/**
 * 确保持有 baseUrl 对应域名的 host 权限：contains 不足则发起 request。
 * ⚠️ chrome.permissions.request 只能在用户手势（点击等）的 UI 上下文中调用，
 * Service Worker 内禁止调用本函数（SW 里只用 hasHostPermission 检查）。
 */
export async function ensureHostPermission(baseUrl: string): Promise<boolean> {
  const pattern = originPatternOf(baseUrl)
  if (await chrome.permissions.contains({ origins: [pattern] })) return true
  return chrome.permissions.request({ origins: [pattern] })
}
