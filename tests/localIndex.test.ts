// 本地索引层单元测试：分词 / 即时搜索排序 / 粗筛候选构建。
// 对应 V0.2.6 搜索架构改造（版本记录/TECH_PLAN_V0.2.6_搜索架构改造.md）。

import { describe, it, expect } from 'vitest'
import {
  tokenize,
  createSearchIndex,
  localSearch,
  buildCandidates,
  CANDIDATE_LIMIT,
} from '@/features/search/lib/localIndex'
import type { Bookmark } from '@/shared/db'

const DAY = 86_400_000
const NOW = Date.now()

let seq = 0
function bm(partial: Partial<Bookmark>): Bookmark {
  seq++
  return {
    id: partial.id ?? `bm-${seq}`,
    url: `https://example.com/${seq}`,
    title: '',
    favicon: '',
    domain: 'example.com',
    summary: '',
    tags: [],
    contentType: '文章',
    folderId: null,
    pinnedIn: [],
    createdAt: NOW - 30 * DAY,
    lastOpenedAt: 0,
    indexStatus: 'done',
    order: seq,
    ...partial,
  }
}

describe('tokenize', () => {
  it('拉丁/数字连续段整词切分并小写', () => {
    const tokens = tokenize('React 19 Hooks')
    expect(tokens).toContain('react')
    expect(tokens).toContain('19')
    expect(tokens).toContain('hooks')
  })

  it('CJK 段产出 bigram（分词器分错时的兜底通道）', () => {
    const tokens = tokenize('动画视频')
    expect(tokens).toContain('动画')
    expect(tokens).toContain('视频')
    expect(tokens).toContain('画视') // bigram 滑窗
  })

  it('单个 CJK 字符保留为 token', () => {
    expect(tokenize('猫')).toContain('猫')
  })

  it('中英混排两类通道并存', () => {
    const tokens = tokenize('CSS动画指南')
    expect(tokens).toContain('css')
    expect(tokens).toContain('动画')
  })
})

describe('localSearch', () => {
  const bookmarks = [
    bm({ id: 'css', title: 'CSS 动画完全指南', summary: '讲解 CSS 动画与过渡的视频教程', tags: ['CSS', '动画', '教程'], contentType: '视频', domain: 'bilibili.com' }),
    bm({ id: 'react', title: 'React 19 新特性详解', summary: '介绍 React 19 的并发特性', tags: ['React', '前端'], domain: 'zhihu.com' }),
    bm({ id: 'prompt', title: '提示词工程实用技巧', summary: '18 个提示词工程技巧', tags: ['提示词', 'AI'], domain: 'sspai.com' }),
  ]
  const index = createSearchIndex(bookmarks)

  it('无空格中文查询能命中（旧整句 includes 实现命中不了）', () => {
    const hits = localSearch(index, '动画视频')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].bookmark.id).toBe('css')
  })

  it('拉丁词查询命中', () => {
    const hits = localSearch(index, 'react')
    expect(hits[0].bookmark.id).toBe('react')
  })

  it('空查询返回空', () => {
    expect(localSearch(index, '   ')).toEqual([])
  })

  it('无关查询返回空', () => {
    expect(localSearch(index, '量子物理')).toEqual([])
  })

  it('title 命中权重高于 summary 命中', () => {
    const pair = [
      bm({ id: 'in-summary', title: '无关标题', summary: '这篇讲机器学习入门' }),
      bm({ id: 'in-title', title: '机器学习入门', summary: '无关摘要' }),
    ]
    const idx = createSearchIndex(pair)
    const hits = localSearch(idx, '机器学习')
    expect(hits[0].bookmark.id).toBe('in-title')
  })

  it('分数归一化到 0~1，首位为 1', () => {
    const hits = localSearch(index, '动画')
    expect(hits[0].score).toBe(1)
    hits.forEach((h) => {
      expect(h.score).toBeGreaterThan(0)
      expect(h.score).toBeLessThanOrEqual(1)
    })
  })

  it('frecency 加成可翻转同等文字匹配的排序', () => {
    const pair = [
      bm({ id: 'a', title: '前端周刊 第一期' }),
      bm({ id: 'b', title: '前端周刊 第二期' }),
    ]
    const idx = createSearchIndex(pair)
    const base = localSearch(idx, '前端周刊')
    const boosted = localSearch(idx, '前端周刊', 5, {
      frecency: new Map([[base[1].bookmark.id, 8]]),
    })
    expect(boosted[0].bookmark.id).toBe(base[1].bookmark.id)
  })

  it('adaptive pinnedId 无条件置顶且标注「上次的选择」', () => {
    const hits = localSearch(index, '动画', 5, { pinnedId: 'prompt' })
    expect(hits[0].bookmark.id).toBe('prompt')
    expect(hits[0].reason).toBe('上次的选择')
    // 不重复出现
    expect(hits.filter((h) => h.bookmark.id === 'prompt')).toHaveLength(1)
  })
})

describe('buildCandidates', () => {
  it('书签数 ≤ 上限时全量直传', () => {
    const few = [bm({}), bm({}), bm({})]
    const idx = createSearchIndex(few)
    expect(buildCandidates(idx, '任意查询', few)).toEqual(few)
  })

  it('超上限时：字面命中优先 + 新近度补满，恰好 N 条且无重复', () => {
    const many: Bookmark[] = []
    for (let i = 0; i < 70; i++) {
      many.push(
        bm({
          id: `filler-${i}`,
          title: `无关内容 ${i}`,
          createdAt: NOW - (70 - i) * DAY, // filler-69 最新，filler-0 最旧
        }),
      )
    }
    many.push(bm({ id: 'target', title: 'TypeScript 类型体操', createdAt: NOW - 300 * DAY }))
    const idx = createSearchIndex(many)

    const cands = buildCandidates(idx, 'typescript', many)
    expect(cands).toHaveLength(CANDIDATE_LIMIT)
    // 字面命中的旧书签必须在候选内（不能被新近度挤掉）
    expect(cands.some((b) => b.id === 'target')).toBe(true)
    // 无重复
    expect(new Set(cands.map((b) => b.id)).size).toBe(cands.length)
    // 缺口按新近度补：最新的 filler 在，最旧的不在
    expect(cands.some((b) => b.id === 'filler-69')).toBe(true)
    expect(cands.some((b) => b.id === 'filler-0')).toBe(false)
  })
})
