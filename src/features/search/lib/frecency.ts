// 搜索排序增强（Firefox frecency / Raycast adaptive history 的简化版，全本地零成本）：
//   frecency — 「经搜索打开书签」事件按频次+新近度指数衰减计分，常用书签排前
//   adaptive — 记住「查询词 → 上次选中的书签」，同词再搜直接置顶
// 存 chrome.storage.local（shared/storage 封装），条目有上限与过期，不会无限膨胀。

import { STORAGE_KEYS, get, set } from '@/shared/storage'

/** frecency 半衰期：30 天不用衰减一半（Firefox 同款参数） */
const HALF_LIFE_MS = 30 * 86_400_000
const FRECENCY_MAX_ENTRIES = 200

/** adaptive 记录 90 天未再命中即过期 */
const ADAPTIVE_TTL_MS = 90 * 86_400_000
const ADAPTIVE_MAX_ENTRIES = 100

interface FrecencyEntry {
  /** 累计分（写入时已按上次时间衰减折算） */
  s: number
  /** 最后一次事件时间戳 */
  t: number
}

interface AdaptiveEntry {
  id: string
  t: number
}

type FrecencyMap = Record<string, FrecencyEntry>
type AdaptiveMap = Record<string, AdaptiveEntry>

const decay = (elapsedMs: number) => Math.pow(0.5, Math.max(0, elapsedMs) / HALF_LIFE_MS)

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

/** 记录一次「经搜索打开书签」事件 */
export async function bumpFrecency(bookmarkId: string): Promise<void> {
  const map = await get<FrecencyMap>(STORAGE_KEYS.searchFrecency, {})
  const now = Date.now()
  const cur = map[bookmarkId]
  map[bookmarkId] = {
    s: (cur ? cur.s * decay(now - cur.t) : 0) + 1,
    t: now,
  }
  // 超上限时按有效分裁掉尾部
  const ids = Object.keys(map)
  if (ids.length > FRECENCY_MAX_ENTRIES) {
    ids
      .sort((a, b) => map[b].s * decay(now - map[b].t) - map[a].s * decay(now - map[a].t))
      .slice(FRECENCY_MAX_ENTRIES)
      .forEach((id) => delete map[id])
  }
  await set(STORAGE_KEYS.searchFrecency, map)
}

/** 读取全部书签的有效 frecency 分（已按当前时间衰减） */
export async function getFrecencyScores(): Promise<Map<string, number>> {
  const map = await get<FrecencyMap>(STORAGE_KEYS.searchFrecency, {})
  const now = Date.now()
  return new Map(
    Object.entries(map).map(([id, e]) => [id, e.s * decay(now - e.t)]),
  )
}

/** 记录「查询词 → 本次选中的书签」 */
export async function recordAdaptiveChoice(query: string, bookmarkId: string): Promise<void> {
  const q = normalizeQuery(query)
  if (!q) return
  const map = await get<AdaptiveMap>(STORAGE_KEYS.searchAdaptive, {})
  const now = Date.now()
  map[q] = { id: bookmarkId, t: now }
  const keys = Object.keys(map)
  // 先清过期，仍超上限则裁最旧
  keys.forEach((k) => {
    if (now - map[k].t > ADAPTIVE_TTL_MS) delete map[k]
  })
  const alive = Object.keys(map)
  if (alive.length > ADAPTIVE_MAX_ENTRIES) {
    alive
      .sort((a, b) => map[b].t - map[a].t)
      .slice(ADAPTIVE_MAX_ENTRIES)
      .forEach((k) => delete map[k])
  }
  await set(STORAGE_KEYS.searchAdaptive, map)
}

/** 读取「查询词 → 上次选中书签」映射（过滤已过期项） */
export async function getAdaptiveChoices(): Promise<Map<string, string>> {
  const map = await get<AdaptiveMap>(STORAGE_KEYS.searchAdaptive, {})
  const now = Date.now()
  return new Map(
    Object.entries(map)
      .filter(([, e]) => now - e.t <= ADAPTIVE_TTL_MS)
      .map(([q, e]) => [q, e.id]),
  )
}
