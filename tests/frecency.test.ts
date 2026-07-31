// frecency / adaptive history 测试：chrome.storage.local 用内存 stub 模拟。

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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
  bumpFrecency,
  getFrecencyScores,
  recordAdaptiveChoice,
  getAdaptiveChoices,
  normalizeQuery,
} from '@/features/search/lib/frecency'

const DAY = 86_400_000
const T0 = new Date('2026-07-31T00:00:00Z').getTime()

beforeEach(() => {
  memStore.clear()
  vi.useFakeTimers()
  vi.setSystemTime(T0)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeQuery', () => {
  it('去空白并小写', () => {
    expect(normalizeQuery('  React 教程  ')).toBe('react 教程')
  })
})

describe('frecency', () => {
  it('连续打开累计计分', async () => {
    await bumpFrecency('bm-1')
    await bumpFrecency('bm-1')
    const scores = await getFrecencyScores()
    expect(scores.get('bm-1')).toBeCloseTo(2, 5)
  })

  it('30 天半衰期指数衰减', async () => {
    await bumpFrecency('bm-1')
    vi.setSystemTime(T0 + 30 * DAY)
    const scores = await getFrecencyScores()
    expect(scores.get('bm-1')).toBeCloseTo(0.5, 5)
  })

  it('衰减后再次打开：旧分折算 + 新事件 +1', async () => {
    await bumpFrecency('bm-1')
    vi.setSystemTime(T0 + 30 * DAY)
    await bumpFrecency('bm-1') // 0.5 + 1
    const scores = await getFrecencyScores()
    expect(scores.get('bm-1')).toBeCloseTo(1.5, 5)
  })
})

describe('adaptive history', () => {
  it('记录查询词→选中书签，读取按 normalizeQuery 命中', async () => {
    await recordAdaptiveChoice('React 教程', 'bm-react')
    const map = await getAdaptiveChoices()
    expect(map.get('react 教程')).toBe('bm-react')
  })

  it('同词再选覆盖旧选择', async () => {
    await recordAdaptiveChoice('教程', 'bm-old')
    await recordAdaptiveChoice('教程', 'bm-new')
    const map = await getAdaptiveChoices()
    expect(map.get('教程')).toBe('bm-new')
  })

  it('90 天未再命中过期', async () => {
    await recordAdaptiveChoice('老查询', 'bm-1')
    vi.setSystemTime(T0 + 91 * DAY)
    const map = await getAdaptiveChoices()
    expect(map.has('老查询')).toBe(false)
  })

  it('空查询不记录', async () => {
    await recordAdaptiveChoice('   ', 'bm-1')
    expect((await getAdaptiveChoices()).size).toBe(0)
  })
})
