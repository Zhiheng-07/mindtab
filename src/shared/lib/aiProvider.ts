// AI 厂商预设与用户配置（chrome.storage 持久化）+ host 权限辅助。
// 依赖 chrome.storage / chrome.permissions，SW 与 UI 均可用
// （ensureHostPermission 例外，见其注释）。

import { STORAGE_KEYS, get, set } from '@/shared/storage'

export type AiProviderId =
  | 'deepseek'
  | 'openai'
  | 'kimi'
  | 'qwen'
  | 'glm'
  | 'doubao'
  | 'siliconflow'
  | 'minimax'
  | 'stepfun'
  | 'mimo'
  | 'claude'
  | 'openrouter'
  | 'custom'

export interface AiProviderPreset {
  id: AiProviderId
  label: string
  baseUrl: string
  defaultModel: string
  /** 厂商控制台「创建 / 管理 API Key」页（2026-09 按各家官方文档核实；厂商改版时维护此处） */
  keyUrl?: string
}

// 注意：defaultModel 为 2026-07 时点的常用型号，厂商可能更新换代，维护时留意。
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    keyUrl: 'https://platform.kimi.com/console/api-keys',
  },
  {
    id: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    keyUrl: 'https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key',
  },
  {
    id: 'glm',
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    keyUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
  },
  {
    id: 'doubao',
    label: '豆包 (火山)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-1-5-lite-32k-250115',
    keyUrl: 'https://ark.volcengine.com/region:cn-beijing/apiKey',
  },
  {
    id: 'siliconflow',
    label: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    defaultModel: 'MiniMax-Text-01',
    keyUrl: 'https://platform.minimax.cn/user-center/basic-information/interface-key',
  },
  {
    id: 'stepfun',
    label: '阶跃星辰',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-2-mini',
    keyUrl: 'https://platform.stepfun.com/interface-key',
  },
  {
    id: 'mimo',
    label: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    defaultModel: 'mimo-v2-flash',
    keyUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
  },
  {
    id: 'claude',
    label: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-latest',
    keyUrl: 'https://platform.claude.com/settings/keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    keyUrl: 'https://openrouter.ai/keys',
  },
]

/**
 * 自定义模式下常用模型建议列表。
 * 涵盖国内外主流模型产品，用户可在此范围快速选择或手动输入。
 */
export const CUSTOM_MODEL_SUGGESTIONS: string[] = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-4-turbo',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-20241022',
  'deepseek-chat',
  'deepseek-reasoner',
  'moonshot-v1-8k',
  'moonshot-v1-32k',
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
  'ernie-3.5-8k',
  'ernie-4.0-8k',
  'glm-4-flash',
  'glm-4-plus',
  'doubao-pro-32k',
  'doubao-lite-32k',
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
 * 容错：
 * - 用户可能把完整端点直接填进 baseUrl → 直接使用
 * - 用户可能以 /v1/chat/completions 结尾 → 直接使用
 * - 否则追加 /chat/completions
 */
export function resolveChatUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  // 如果已包含 chat/completions 路径，直接使用
  if (/\/chat\/completions$/.test(base)) return base
  // 如果以 /v1 结尾，追加 chat/completions
  if (/\/v1$/.test(base)) return `${base}/chat/completions`
  // 其他情况也追加 chat/completions（兼容自定义路径）
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
