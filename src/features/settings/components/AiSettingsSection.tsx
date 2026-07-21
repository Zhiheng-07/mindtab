// AI 服务设置区块：厂商选择 / API Key / baseUrl / model / 测试连接 / 保存。
// 挂载在 SettingsModal 内（「通用」与「数据管理」之间）。
//
// ⚠️ 权限手势约束：chrome.permissions.request 只能在用户手势中调用，
// 且调用链上它之前不能有任何耗尽 activation 的 await。因此测试/保存按钮的
// onClick 为同步函数：先做同步校验，然后**第一个异步操作**就是
// ensureHostPermission(draft.baseUrl)（其内部 contains → request 均为
// chrome API，gesture 状态可穿透）。草稿全部来自 React state，handler 内
// 不读 storage。

import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  AI_PROVIDER_PRESETS,
  ensureHostPermission,
  getAiConfig,
  setAiConfig,
  type AiConfig,
  type AiProviderId,
} from '@/shared/lib/aiProvider'
import { testAiConnection } from '@/shared/lib/aiClient'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { useToastStore } from '@/features/toast'
import { Row, Section, Segmented } from './SettingsPrimitives'

const PRIVACY_NOTE =
  'API Key 仅保存在你的浏览器本地（chrome.storage.local），请求直接发送给你选择的服务商，不经过任何第三方服务器'

const CUSTOM_BASE_URL_PLACEHOLDER = '填到 /v1 为止，如 https://api.example.com/v1'

function presetOf(id: AiProviderId) {
  return AI_PROVIDER_PRESETS.find((p) => p.id === id)
}

/** Segmented 用短标签（'Kimi (Moonshot)' 太宽） */
function shortLabel(id: AiProviderId, label: string) {
  return id === 'kimi' ? 'Kimi' : label
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

export function AiSettingsSection() {
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
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)

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
    if (next === 'custom') {
      // 回填已保存的自定义配置（若有）
      if (saved?.provider === 'custom') {
        setCustomBaseUrl(saved.baseUrl)
        setModel(saved.model)
      } else {
        setModel('')
      }
    } else {
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
      pushToast('error', '请先填写 API Key')
      return null
    }
    if (provider === 'custom' && !baseUrl) {
      pushToast('error', '请填写 Base URL')
      return null
    }
    if (!mdl) {
      pushToast('error', '请填写模型名称')
      return null
    }
    try {
      void new URL(baseUrl)
    } catch {
      pushToast('error', 'Base URL 格式无效，请填写完整地址（含 https://）')
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
          pushToast('error', `未授权访问 ${hostOf(draft.baseUrl)} 域名，无法调用 AI 服务`)
          return
        }
        setTestResult(await testAiConnection(draft))
      })
      .catch((e) => {
        pushToast('error', `测试失败：${truncateError((e as Error).message)}`)
      })
      .finally(() => setTesting(false))
  }

  // onClick 保持同步；第一个异步操作是 ensureHostPermission
  const handleSave = () => {
    const draft = buildValidatedDraft()
    if (!draft) return
    setSaving(true)
    ensureHostPermission(draft.baseUrl)
      .then(async (granted) => {
        if (!granted) {
          pushToast('error', `未授权访问 ${hostOf(draft.baseUrl)} 域名，无法调用 AI 服务`)
          return
        }
        await setAiConfig(draft)
        setSaved(draft)
        pushToast('success', 'AI 配置已保存')
      })
      .catch((e) => {
        pushToast('error', `保存失败：${truncateError((e as Error).message)}`)
      })
      .finally(() => setSaving(false))
  }

  const summary = saved
    ? `已配置：${presetOf(saved.provider)?.label ?? '自定义'} · ${saved.model}`
    : '未配置：选择服务商并填写 API Key 后，即可使用 AI 摘要与智能搜索'

  return (
    <Section title="AI 服务">
      <Row label="AI 服务配置" hint={summary} />

      <Row
        label="服务商"
        hint={preset ? `接入点 ${preset.baseUrl}` : undefined}
      >
        <Segmented
          value={provider}
          options={[
            ...AI_PROVIDER_PRESETS.map((p) => ({
              value: p.id,
              label: shortLabel(p.id, p.label),
            })),
            { value: 'custom', label: '自定义' },
          ]}
          onChange={handleProviderChange}
        />
      </Row>

      <FieldRow label="API Key">
        <div style={{ position: 'relative' }}>
          <Input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
            className="h-9 pr-9"
            onChange={(e) => {
              setApiKey(e.target.value)
              setTestResult(null)
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
            }}
          />
        </FieldRow>
      )}

      <FieldRow label="模型">
        <Input
          type="text"
          value={model}
          placeholder={provider === 'custom' ? '如 gpt-4o-mini' : undefined}
          autoComplete="off"
          spellCheck={false}
          className="h-9"
          onChange={(e) => {
            setModel(e.target.value)
            setTestResult(null)
          }}
        />
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
          {saving ? '保存中…' : '保存'}
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
            }}
            title={testResult.ok ? undefined : testResult.error}
          >
            {testResult.ok
              ? '✓ 连接成功'
              : `✗ ${truncateError(testResult.error ?? '连接失败', 60)}`}
          </span>
        )}
      </div>

      <Row label="隐私说明" hint={PRIVACY_NOTE} />
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
