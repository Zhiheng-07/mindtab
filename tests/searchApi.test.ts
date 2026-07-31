// api.searchBookmarks 的序号→真实 id 映射测试（mock 掉网络层 chatComplete）。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchBookmarks, type SearchCandidate } from '@/shared/lib/api'
import { chatComplete } from '@/shared/lib/aiClient'

vi.mock('@/shared/lib/aiClient', () => ({
  chatComplete: vi.fn(),
}))

const mockChat = vi.mocked(chatComplete)

function cand(id: string, title: string): SearchCandidate {
  return {
    id,
    title,
    domain: 'example.com',
    summary: '',
    tags: [],
    contentType: '文章',
    createdDaysAgo: 1,
    openedDaysAgo: null,
  }
}

const candidates = [cand('uuid-aaa', 'A'), cand('uuid-bbb', 'B'), cand('uuid-ccc', 'C')]

beforeEach(() => {
  mockChat.mockReset()
})

describe('searchBookmarks 序号映射', () => {
  it('模型返回序号 → 映射回候选的真实 id', async () => {
    mockChat.mockResolvedValue(
      '{"results":[{"i":1,"score":0.9,"reason":"r1"},{"i":0,"score":0.5,"reason":"r0"}]}',
    )
    const hits = await searchBookmarks('q', candidates)
    expect(hits.map((h) => h.id)).toEqual(['uuid-bbb', 'uuid-aaa'])
  })

  it('越界序号丢弃', async () => {
    mockChat.mockResolvedValue('{"results":[{"i":99,"score":0.9,"reason":"r"}]}')
    expect(await searchBookmarks('q', candidates)).toEqual([])
  })

  it('旧 id 形状仅在属于候选集时接受', async () => {
    mockChat.mockResolvedValue(
      '{"results":[{"id":"uuid-ccc","score":0.7,"reason":"in"},{"id":"uuid-fake","score":0.9,"reason":"out"}]}',
    )
    const hits = await searchBookmarks('q', candidates)
    expect(hits).toHaveLength(1)
    expect(hits[0].id).toBe('uuid-ccc')
  })

  it('对外返回结构保持 SearchHit（id/score/reason）不变', async () => {
    mockChat.mockResolvedValue('{"results":[{"i":2,"score":0.66,"reason":"这份文档可能是你在找的"}]}')
    const hits = await searchBookmarks('q', candidates)
    expect(hits[0]).toEqual({ id: 'uuid-ccc', score: 0.66, reason: '这份文档可能是你在找的' })
  })
})
