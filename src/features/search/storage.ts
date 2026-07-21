// 搜索历史（chrome.storage.local）。
// 通用读写与 key 常量来自 shared/storage。

import { STORAGE_KEYS, get, set } from '@/shared/storage'

// ───── 搜索历史 ─────

const HISTORY_MAX = 15

export async function getSearchHistory(): Promise<string[]> {
  return get<string[]>(STORAGE_KEYS.searchHistory, [])
}

export async function pushSearchHistory(query: string): Promise<string[]> {
  const q = query.trim()
  if (!q) return getSearchHistory()
  const cur = await getSearchHistory()
  const next = [q, ...cur.filter((x) => x !== q)].slice(0, HISTORY_MAX)
  await set(STORAGE_KEYS.searchHistory, next)
  return next
}

export async function clearSearchHistory(): Promise<void> {
  await set(STORAGE_KEYS.searchHistory, [])
}
