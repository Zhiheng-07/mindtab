// AI 服务设置区块：厂商选择 / API Key / baseUrl / model / 测试连接 / 保存。
// 挂载在 SettingsModal 内（「通用」与「数据管理」之间）；
// 也以 variant="guide" 形态挂在 onboarding 的 AI 绑定引导弹窗内。
//
// ⚠️ 权限手势约束：chrome.permissions.request 只能在用户手势中调用，
// 且调用链上它之前不能有任何耗尽 activation 的 await。因此测试/保存按钮的
// onClick 为同步函数：先做同步校验，然后**第一个异步操作**就是
// ensureHostPermission(draft.baseUrl)（其内部 contains → request 均为
// chrome API，gesture 状态可穿透）。草稿全部来自 React state，handler 内
// 不读 storage。

import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import {
  AI_PROVIDER_PRESETS,
  CUSTOM_MODEL_SUGGESTIONS,
  ensureHostPermission,
  getAiConfig,
  setAiConfig,
  type AiConfig,
  type AiProviderId,
} from '@/shared/lib/aiProvider'
import { testAiConnection, fetchModels } from '@/shared/lib/aiClient'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/shared/ui/dropdown-menu'
import { useToastStore } from '@/features/toast'
import { Row, Section } from './SettingsPrimitives'

const PRIVACY_NOTE =
  'API Key 仅保存在你的浏览器本地（chrome.storage.local），请求直接发送给你选择的服务商，不经过任何第三方服务器'

const CUSTOM_BASE_URL_PLACEHOLDER = '填到 /v1 为止（如 https://api.example.com/v1）或完整 endpoint 路径'

function presetOf(id: AiProviderId) {
  return AI_PROVIDER_PRESETS.find((p) => p.id === id)
}

function truncateError(msg: string, max = 120): string {
  const oneLine = msg.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

function hostOf(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

interface Props {
  /**
   * settings：设置面板内（默认）。
   * guide：首次 AI 绑定引导弹窗内——隐藏分组标题 / 配置摘要 / 隐私说明（弹窗自带说明），
   * 保存按钮文案改为「保存并开始使用」。
   */
  variant?: 'settings' | 'guide'
  /** 保存成功后回调（引导弹窗据此关闭） */
  onSaved?: () => void
}

export function AiSettingsSection({ variant = 'settings', onSaved }: Props = {}) {
  const isGuide = variant === 'guide'
  const pushToast = useToastStore((s) => s.pushToast)

  // ── 草稿 state（handler 只读这里，不读 storage）──
  const [provider, setProvider] = useState<AiProviderId>('deepseek')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(presetOf('deepseek')!.defaultModel)
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [showKey, setShowKey] = useState(false)

  // 已保存配置（用于顶部摘要 + 切换厂商时回填草稿）
  const [saved, setSaved] = useState<AiConfig | null>(null)

  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{
    ok: boolean
    error?: string
    permissionDenied?: boolean
  } | null>(null)

  // 自定义模型建议下拉
  const [showModelSuggestions, setShowModelSuggestions] = useState(false)
  // 建议列表过滤词：独立于 model 值。聚焦时置空（显示全部），用户输入才过滤——
  // 避免预填的模型名把整个列表过滤成"无匹配"。
  const [modelFilter, setModelFilter] = useState('')

  // 拉取到的模型列表（每次打开设置重新拉取即可）
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null)
  const [fetchingModels, setFetchingModels] = useState(false)

  // SettingsModal 打开时本组件才被挂载，挂载时加载一次已保存配置进草稿
  useEffect(() => {
    void getAiConfig().then((cfg) => {
      if (!cfg) return
      setSaved(cfg)
      setProvider(cfg.provider)
      setApiKey(cfg.apiKey)
      setModel(cfg.model)
      if (cfg.provider === 'custom') setCustomBaseUrl(cfg.baseUrl)
    })
  }, [])

  const preset = provider === 'custom' ? null : presetOf(provider)
  const effectiveBaseUrl = preset ? preset.baseUrl : customBaseUrl

  const handleProviderChange = (v: string) => {
    const next = v as AiProviderId
    setProvider(next)
    setTestResult(null)
    setShowModelSuggestions(false)
    // 模型列表按厂商拉取，切换厂商后旧列表作废
    setFetchedModels(null)
    setModelFilter('')
    if (next === 'custom') {
      // 回填已保存的自定义配置（若有），否则全部清空
      if (saved?.provider === 'custom') {
        setCustomBaseUrl(saved.baseUrl)
        setModel(saved.model)
      } else {
        setCustomBaseUrl('')
        setModel('')
      }
    } else {
      // 切出自定义时清除自定义字段
      setCustomBaseUrl('')
      const p = presetOf(next)!
      setModel(saved?.provider === next ? saved.model : p.defaultModel)
    }
  }

  /** 同步校验草稿；不合法时 toast 并返回 null。必须保持同步（见文件头注释）。 */
  const buildValidatedDraft = (): AiConfig | null => {
    const key = apiKey.trim()
    const baseUrl = effectiveBaseUrl.trim()
    const mdl = model.trim()
    if (!key) {
      pushToast('error', '请先填写 API Key', 'ai-key-empty')
      return null
    }
    if (provider === 'custom' && !baseUrl) {
      pushToast('error', '请填写 Base URL', 'ai-baseurl-empty')
      return null
    }
    if (!mdl) {
      pushToast('error', '请填写模型名称', 'ai-model-empty')
      return null
    }
    try {
      void new URL(baseUrl)
    } catch {
      pushToast('error', 'Base URL 格式无效，请填写完整地址（含 https://）', 'ai-baseurl-invalid')
      return null
    }
    return { provider, apiKey: key, baseUrl, model: mdl }
  }

  // onClick 保持同步；第一个异步操作是 ensureHostPermission
  const handleTest = () => {
    const draft = buildValidatedDraft()
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    ensureHostPermission(draft.baseUrl)
      .then(async (granted) => {
        if (!granted) {
          setTestResult({
            ok: false,
            error: `未授权访问 ${hostOf(draft.baseUrl)}，请点击「重新授权」以授予域名权限`,
            permissionDenied: true,
          })
          return
        }
        setTestResult(await testAiConnection(draft))
      })
      .catch((e) => {
        setTestResult({
          ok: false,
          error: `测试失败：${truncateError((e as Error).message)}`,
        })
      })
      .finally(() => setTesting(false))
  }

  /** 重新申请 host 权限（权限被拒后的恢复路径） */
  const handleRetryPermission = () => {
    const draft = buildValidatedDraft()
    if (!draft) return
    setTesting(true)
    setTestResult(null)
    ensureHostPermission(draft.baseUrl)
      .then(async (granted) => {
        if (!granted) {
          setTestResult({
            ok: false,
            error: `仍被拒绝：未授权访问 ${hostOf(draft.baseUrl)}`,
            permissionDenied: true,
          })
          return
        }
        setTestResult(await testAiConnection(draft))
      })
      .catch((e) => {
        setTestResult({
          ok: false,
          error: `重新授权失败：${truncateError((e as Error).message)}`,
        })
      })
      .finally(() => setTesting(false))
  }

  /** 轻量校验：仅检查 Key + baseUrl（不校验模型名——拉取模型时模型可能为空） */
  const buildFetchDraft = (): AiConfig | null => {
    const key = apiKey.trim()
    const baseUrl = effectiveBaseUrl.trim()
    if (!key) {
      pushToast('error', '请先填写 API Key', 'ai-key-empty')
      return null
    }
    if (!baseUrl) {
      pushToast('error', '请填写 Base URL', 'ai-baseurl-empty')
      return null
    }
    try {
      void new URL(baseUrl)
    } catch {
      pushToast('error', 'Base URL 格式无效，请填写完整地址（含 https://）', 'ai-baseurl-invalid')
      return null
    }
    return { provider, apiKey: key, baseUrl, model: model.trim() || '' }
  }

  /** 拉取可用模型列表。必须符合手势约束（onClick 同步 → 第一个异步操作为 ensureHostPermission）。 */
  const handleFetchModels = () => {
    const draft = buildFetchDraft()
    if (!draft) return
    setFetchingModels(true)
    ensureHostPermission(draft.baseUrl)
      .then(async (granted) => {
        if (!granted) {
          pushToast('error', `未授权访问 ${hostOf(draft.baseUrl)} 域名，无法拉取模型列表`, 'ai-fetch-perm')
          return
        }
        const models = await fetchModels(draft)
        setFetchedModels(models)
        // 清空过滤词，立即展示完整拉取结果
        setModelFilter('')
        setShowModelSuggestions(true)
        pushToast('success', `获取到 ${models.length} 个可用模型`, 'ai-fetch-models')
      })
      .catch((e) => {
        pushToast('error', `获取模型列表失败：${truncateError((e as Error).message)}`, 'ai-fetch-fail')
      })
      .finally(() => setFetchingModels(false))
  }

  // onClick 保持同步；第一个异步操作是 ensureHostPermission
  const handleSave = () => {
    const draft = buildValidatedDraft()
    if (!draft) return
    setSaving(true)
    ensureHostPermission(draft.baseUrl)
      .then(async (granted) => {
        if (!granted) {
          pushToast('error', `未授权访问 ${hostOf(draft.baseUrl)} 域名，无法调用 AI 服务`, 'ai-save-perm')
          return
        }
        await setAiConfig(draft)
        setSaved(draft)
        pushToast('success', 'AI 配置已保存', 'ai-config-save')
        onSaved?.()
      })
      .catch((e) => {
        pushToast('error', `保存失败：${truncateError((e as Error).message)}`, 'ai-save-fail')
      })
      .finally(() => setSaving(false))
  }

  const summary = saved
    ? `已配置：${presetOf(saved.provider)?.label ?? '自定义'} · ${saved.model}`
    : '未配置：选择服务商并粘贴 API Key 后，即可使用 AI 摘要与智能搜索'

  // ── 模型建议列表数据源 ──
  // 有拉取结果时全部使用拉取结果；自定义模式下无拉取结果时用静态建议列表兜底
  const modelSuggestions: string[] =
    fetchedModels ?? (provider === 'custom' ? CUSTOM_MODEL_SUGGESTIONS : [])
  const effectivePlaceholder =
    provider === 'custom'
      ? '如 gpt-4o-mini，支持从常用列表选择'
      : fetchedModels
        ? '从已获取的列表中选择或手动输入'
        : undefined

  return (
    <Section title={isGuide ? undefined : 'AI 服务'}>
      {!isGuide && <Row label="AI 服务配置" hint={summary} />}

      <Row
        label="服务商"
        hint={preset ? `接入点 ${preset.baseUrl}` : '自定义 OpenAI 兼容接入点'}
      >
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full active:scale-[0.98] gap-1.5"
            >
              {provider === 'custom' ? '自定义' : (presetOf(provider)?.label ?? provider)}
              <ChevronDown size={14} className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          {/* z-[300]：设置模态蒙层 zIndex 280，需盖过它（组件默认 z-50 会被蒙层遮住） */}
          <DropdownMenuContent align="end" className="min-w-[180px] z-[300]">
            <DropdownMenuRadioGroup value={provider} onValueChange={handleProviderChange}>
              {AI_PROVIDER_PRESETS.map((p) => (
                <DropdownMenuRadioItem key={p.id} value={p.id}>
                  {p.label}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value="custom">自定义</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>

      <FieldRow label="API Key">
        <div style={{ position: 'relative' }}>
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            placeholder="sk-… 或你所用 API 的 Key"
            autoComplete="off"
            spellCheck={false}
            className="h-9 pr-9"
            onChange={(e) => {
              setApiKey(e.target.value)
              setTestResult(null)
              setFetchedModels(null)
            }}
          />
          <button
            type="button"
            aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
            onClick={() => setShowKey((v) => !v)}
            className="opacity-60 transition-opacity hover:opacity-100 cursor-pointer outline-none"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--mt-text-muted)',
              padding: 2,
            }}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {saved && saved.provider !== provider && apiKey.trim() && (
          <span style={{ fontSize: 11, color: 'var(--mt-text-muted)', marginTop: 4 }}>
            不同服务商需使用各自的 API Key
          </span>
        )}
        {preset?.keyUrl && (
          <a
            href={preset.keyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start mt-1 text-[11px] text-[var(--mt-text-muted)] underline underline-offset-2 hover:text-[var(--mt-text-strong)] transition-colors"
          >
            去 {preset.label} 控制台获取 API Key ↗
          </a>
        )}
      </FieldRow>

      {provider === 'custom' && (
        <FieldRow label="Base URL">
          <Input
            type="text"
            value={customBaseUrl}
            placeholder={CUSTOM_BASE_URL_PLACEHOLDER}
            autoComplete="off"
            spellCheck={false}
            className="h-9"
            onChange={(e) => {
              setCustomBaseUrl(e.target.value)
              setTestResult(null)
              setFetchedModels(null)
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--mt-text-muted)', marginTop: 4 }}>
            OpenAI 兼容协议及其他主流 API 均可用。支持填到 /v1 或直接填完整 endpoint 路径
          </span>
        </FieldRow>
      )}

      <FieldRow label="模型">
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Input
                type="text"
                value={model}
                placeholder={effectivePlaceholder}
                autoComplete="off"
                spellCheck={false}
                className="h-9"
                onChange={(e) => {
                  setModel(e.target.value)
                  // 用户实际输入才作为过滤词（区别于预填/点选的值）
                  setModelFilter(e.target.value)
                  setTestResult(null)
                  if (modelSuggestions.length > 0) setShowModelSuggestions(true)
                }}
                onFocus={() => {
                  // 聚焦时清空过滤词 → 显示完整列表（预填的模型名不应过滤掉列表）
                  setModelFilter('')
                  if (modelSuggestions.length > 0) setShowModelSuggestions(true)
                }}
                onBlur={() => {
                  setTimeout(() => setShowModelSuggestions(false), 180)
                }}
              />
              {showModelSuggestions && modelSuggestions.length > 0 && (
                <div
                  className="glass-solid glass-border"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    // 需盖过后续兄弟内容（操作按钮行等）；与设置模态内其他浮层层级一致
                    zIndex: 300,
                    marginTop: 2,
                    borderRadius: 'var(--mt-radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}
                >
                  {modelSuggestions.filter(
                    (m) => !modelFilter || m.toLowerCase().includes(modelFilter.toLowerCase()),
                  ).length === 0 ? (
                    <div
                      style={{
                        padding: '8px 12px',
                        fontSize: 12,
                        color: 'var(--mt-text-muted)',
                      }}
                    >
                      无匹配模型，可手动输入
                    </div>
                  ) : (
                    modelSuggestions
                      .filter(
                        (m) => !modelFilter || m.toLowerCase().includes(modelFilter.toLowerCase()),
                      )
                      .map((m) => (
                        <button
                          key={m}
                          type="button"
                          style={{
                            display: 'block',
                            width: '100%',
                            padding: '6px 12px',
                            fontSize: 13,
                            textAlign: 'left',
                            border: 'none',
                            color: 'var(--mt-text-strong)',
                            cursor: 'pointer',
                          }}
                          className={
                            m === model
                              ? 'bg-[var(--mt-bg-tertiary)] hover:bg-[var(--mt-surface-hover)] transition-colors'
                              : 'bg-transparent hover:bg-[var(--mt-surface-hover)] transition-colors'
                          }
                          onMouseDown={() => {
                            setModel(m)
                            setModelFilter(m)
                            setShowModelSuggestions(false)
                            setTestResult(null)
                          }}
                        >
                          {m}
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full active:scale-[0.96] shrink-0"
              onClick={handleFetchModels}
              disabled={fetchingModels || testing || saving}
            >
              {fetchingModels ? '获取中…' : '获取模型列表'}
            </Button>
          </div>
          {fetchedModels && (
            <span style={{ fontSize: 11, color: 'var(--mt-text-muted)', marginTop: 4 }}>
              已获取 {fetchedModels.length} 个可用模型
            </span>
          )}
        </div>
      </FieldRow>

      {/* 操作行：测试连接 / 保存 + 行内结果 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
        }}
      >
        <Button
          variant="outline"
          size="sm"
          className="rounded-full active:scale-[0.96]"
          onClick={handleTest}
          disabled={testing || saving}
        >
          {testing ? '测试中…' : '测试连接'}
        </Button>
        <Button
          size="sm"
          className="rounded-full active:scale-[0.96]"
          onClick={handleSave}
          disabled={testing || saving}
        >
          {saving ? '保存中…' : isGuide ? '保存并开始使用' : '保存'}
        </Button>
        {testResult && (
          <span
            style={{
              fontSize: 12,
              color: testResult.ok ? 'var(--mt-success)' : 'var(--mt-error)',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            title={testResult.ok ? undefined : testResult.error}
          >
            {testResult.ok
              ? '✓ 连接成功'
              : `✗ ${truncateError(testResult.error ?? '连接失败', 60)}`}
            {testResult.permissionDenied && (
              <button
                type="button"
                onClick={handleRetryPermission}
                disabled={testing}
                style={{
                  fontSize: 11,
                  color: 'var(--mt-accent)',
                  background: 'none',
                  border: '1px solid var(--mt-border)',
                  borderRadius: 'var(--mt-radius-sm)',
                  padding: '1px 8px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                className="hover:bg-[var(--mt-surface-hover)]"
              >
                重新授权
              </button>
            )}
          </span>
        )}
      </div>

      {!isGuide && <Row label="隐私说明" hint={PRIVACY_NOTE} />}
    </Section>
  )
}

// ───── 内部子组件：纵向表单行（label 在上、输入框占满整行）─────
// Row 是「label 左 / 控件右」布局，不适合宽输入框，这里补一个同视觉语言的纵向变体。

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '14px 16px',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--mt-text-strong)' }}>{label}</span>
      {children}
    </div>
  )
}
