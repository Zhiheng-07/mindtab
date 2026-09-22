// AI 绑定引导展示判定 + 「已弹出」标记测试：chrome.storage.local 用内存 stub 模拟。

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── chrome.storage.local 内存 stub（对齐 shared/storage/engine.ts 的用法）──
const memStore = new Map<string, unknown>()
vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: memStore.get(key) }),
      set: async (obj: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(obj)) memStore.set(k, v)
      },
      remove: async (key: string) => {
        memStore.delete(key)
      },
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  },
})

import {
  decideAiGuide,
  getAiGuideShown,
  markAiGuideShown,
  type AiGuideInput,
} from '@/features/onboarding/lib/aiGuide'

// 基准：已同意隐私、无其他弹窗、从未弹过、未配置 AI → 应弹
const base: AiGuideInput = {
  privacy: 'agreed',
  privacyModalOpen: false,
  whatsNewOpen: false,
  guideShown: false,
  aiConfigured: false,
}

describe('decideAiGuide', () => {
  it('新用户同意隐私后（未配置、未弹过）→ 弹', () => {
    expect(decideAiGuide(base)).toBe(true)
  })

  it('新用户隐私弹窗还开着（未同意）→ 不弹', () => {
    expect(decideAiGuide({ ...base, privacy: 'unknown', privacyModalOpen: true })).toBe(false)
  })

  it('拒绝隐私的用户 → 不弹', () => {
    expect(decideAiGuide({ ...base, privacy: 'dismissed' })).toBe(false)
  })

  it('升级用户版本更新弹窗还开着 → 不弹（排在其后）', () => {
    expect(decideAiGuide({ ...base, whatsNewOpen: true })).toBe(false)
  })

  it('升级用户关掉版本更新弹窗后（未配置）→ 弹', () => {
    expect(decideAiGuide({ ...base, whatsNewOpen: false })).toBe(true)
  })

  it('已配置 AI → 不弹', () => {
    expect(decideAiGuide({ ...base, aiConfigured: true })).toBe(false)
  })

  it('已弹过 → 不再弹', () => {
    expect(decideAiGuide({ ...base, guideShown: true })).toBe(false)
  })
})

describe('aiGuideShown 标记', () => {
  beforeEach(() => memStore.clear())

  it('默认未弹过', async () => {
    expect(await getAiGuideShown()).toBe(false)
  })

  it('mark 后读取为已弹过，写入 mt:aiGuideShown', async () => {
    await markAiGuideShown()
    expect(await getAiGuideShown()).toBe(true)
    expect(memStore.get('mt:aiGuideShown')).toBe(true)
  })
})
