// LLM 精排 prompt 构建与响应解析测试（纯函数层）。

import { describe, it, expect } from 'vitest'
import {
  buildSearchMessages,
  parseSearchResponse,
  type SearchCandidate,
} from '@/shared/lib/aiPrompts'

function cand(partial: Partial<SearchCandidate>): SearchCandidate {
  return {
    id: 'id-1',
    title: '标题',
    domain: 'example.com',
    summary: '摘要',
    tags: ['标签'],
    contentType: '文章',
    createdDaysAgo: 10,
    openedDaysAgo: 3,
    ...partial,
  }
}

describe('buildSearchMessages', () => {
  it('候选按序号紧凑行格式输出', () => {
    const msgs = buildSearchMessages('测试查询', [
      cand({ id: 'a', title: 'React 指南' }),
      cand({ id: 'b', title: 'Vue 手册' }),
    ])
    const user = msgs[1].content
    expect(user).toContain('[0] React 指南')
    expect(user).toContain('[1] Vue 手册')
    expect(user).toContain('查询: 测试查询')
    // 不再整包 JSON.stringify（不应出现 UUID 键名结构）
    expect(user).not.toContain('"id"')
  })

  it('摘要截断 60 字', () => {
    const long = '长'.repeat(100)
    const msgs = buildSearchMessages('q', [cand({ summary: long })])
    expect(msgs[1].content).toContain('长'.repeat(60))
    expect(msgs[1].content).not.toContain('长'.repeat(61))
  })

  it('时间字段：打开天数与未打开', () => {
    const msgs = buildSearchMessages('q', [
      cand({ createdDaysAgo: 45, openedDaysAgo: 3 }),
      cand({ createdDaysAgo: 7, openedDaysAgo: null }),
    ])
    expect(msgs[1].content).toContain('收藏45d/打开3d')
    expect(msgs[1].content).toContain('收藏7d/未打开')
  })

  it('system prompt 含 JSON 字样（json_object 模式要求）与抗注入安全规则', () => {
    const sys = buildSearchMessages('q', [cand({})])[0].content
    expect(sys).toContain('JSON')
    expect(sys).toContain('安全规则')
    expect(sys).toContain('纯数据')
    // 对话语气 match_reason 规范（对齐《02 · AI能力说明》定稿）
    expect(sys).toContain('可能是你在找的')
  })

  it('候选超 500 条时截断（安全网）', () => {
    const many = Array.from({ length: 501 }, (_, i) => cand({ id: `c-${i}`, title: `t${i}` }))
    const user = buildSearchMessages('q', many)[1].content
    const lines = user.match(/^\[\d+\]/gm) ?? []
    expect(lines).toHaveLength(500)
  })
})

describe('parseSearchResponse', () => {
  it('新形状：数字序号 i', () => {
    const hits = parseSearchResponse('{"results":[{"i":2,"score":0.9,"reason":"这篇讲 X 的文章可能是你在找的"}]}')
    expect(hits).toHaveLength(1)
    expect(hits[0].index).toBe(2)
    expect(hits[0].score).toBe(0.9)
  })

  it('旧形状兼容：字符串 id', () => {
    const hits = parseSearchResponse('{"results":[{"id":"bm-1","score":0.8,"reason":"r"}]}')
    expect(hits[0].id).toBe('bm-1')
    expect(hits[0].index).toBeUndefined()
  })

  it('《02》文档字段名兼容：relevance_score / match_reason', () => {
    const hits = parseSearchResponse(
      '{"results":[{"i":0,"relevance_score":0.95,"match_reason":"这个工具可能是你在找的"}]}',
    )
    expect(hits[0].score).toBe(0.95)
    expect(hits[0].reason).toBe('这个工具可能是你在找的')
  })

  it('非法条目丢弃：负数/非整数序号、缺 i 和 id', () => {
    const hits = parseSearchResponse(
      '{"results":[{"i":-1,"score":1},{"i":1.5,"score":1},{"score":1},{"i":0,"score":0.5,"reason":"ok"}]}',
    )
    expect(hits).toHaveLength(1)
    expect(hits[0].index).toBe(0)
  })

  it('容忍 markdown 代码块包裹', () => {
    const hits = parseSearchResponse('```json\n{"results":[{"i":0,"score":0.6,"reason":"r"}]}\n```')
    expect(hits).toHaveLength(1)
  })

  it('乱输出兜底空数组', () => {
    expect(parseSearchResponse('抱歉，我无法处理')).toEqual([])
    expect(parseSearchResponse('{"results":"not-array"}')).toEqual([])
  })
})
