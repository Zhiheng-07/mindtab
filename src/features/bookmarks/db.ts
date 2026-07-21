// 书签表（bookmarks）CRUD。
// 跨表操作（applyIndex / findByUrl / clearAllData）见 shared/db。

import { openDB, tx } from '@/shared/db/connection'
import type { Bookmark } from '@/shared/db/types'

export function addBookmark(item: Bookmark): Promise<IDBValidKey> {
  return tx('bookmarks', 'readwrite', (s) => s.add(item))
}

export function getAllBookmarks(): Promise<Bookmark[]> {
  return tx('bookmarks', 'readonly', (s) => s.getAll() as IDBRequest<Bookmark[]>)
}

export function deleteBookmark(id: string): Promise<undefined> {
  return tx('bookmarks', 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export async function updateBookmark(
  id: string,
  patch: Partial<Bookmark>,
): Promise<Bookmark> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('bookmarks', 'readwrite')
    const s = t.objectStore('bookmarks')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const cur = getReq.result as Bookmark | undefined
      if (!cur) return reject(new Error(`bookmark ${id} not found`))
      const next = { ...cur, ...patch, id: cur.id }
      const putReq = s.put(next)
      putReq.onsuccess = () => resolve(next)
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export async function togglePin(id: string, scope: string): Promise<Bookmark> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('bookmarks', 'readwrite')
    const s = t.objectStore('bookmarks')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const cur = getReq.result as Bookmark | undefined
      if (!cur) return reject(new Error(`bookmark ${id} not found`))
      const arr = cur.pinnedIn ?? []
      const next: Bookmark = {
        ...cur,
        pinnedIn: arr.includes(scope) ? arr.filter((k) => k !== scope) : [...arr, scope],
      }
      const putReq = s.put(next)
      putReq.onsuccess = () => resolve(next)
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

/** ids 按目标顺序排列，分配递减 order 值使第一个 order 最大 */
export async function reorderBookmarks(ids: string[]): Promise<Map<string, number>> {
  const db = await openDB()
  const base = Date.now()
  const map = new Map<string, number>()
  return new Promise((resolve, reject) => {
    const t = db.transaction('bookmarks', 'readwrite')
    const s = t.objectStore('bookmarks')
    ids.forEach((id, i) => {
      const order = base - i
      map.set(id, order)
      const req = s.get(id)
      req.onsuccess = () => {
        const cur = req.result as Bookmark | undefined
        if (cur) s.put({ ...cur, order })
      }
    })
    t.oncomplete = () => resolve(map)
    t.onerror = () => reject(t.error)
  })
}

export function touchOpened(id: string): Promise<Bookmark> {
  return updateBookmark(id, { lastOpenedAt: Date.now() })
}

export function moveBookmark(id: string, folderId: string | null): Promise<Bookmark> {
  return updateBookmark(id, { folderId })
}

// ───── 待索引扫描（启动重试 / 手动重索引）─────
//
// drain / tickRetry 走 by-indexStatus 索引取 'pending'，不再全表 getAll + JS filter。
// 只取 'pending'：导入写入即 'pending'；单页收藏的 'indexing' 由 runIndexing 单独终结，
// 失败也回退成 'pending'，会被下一轮捡到，故 drain 无需覆盖 'indexing'。

/** 取最多 limit 条待索引（indexStatus==='pending'）书签，走索引游标，够数即停。 */
export async function getUnindexedBatch(limit: number): Promise<Bookmark[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('bookmarks', 'readonly')
    const idx = t.objectStore('bookmarks').index('by-indexStatus')
    const out: Bookmark[] = []
    const cursorReq = idx.openCursor(IDBKeyRange.only('pending'))
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result
      if (!cursor || out.length >= limit) return resolve(out)
      out.push(cursor.value as Bookmark)
      if (out.length >= limit) return resolve(out)
      cursor.continue()
    }
    cursorReq.onerror = () => reject(cursorReq.error)
  })
}

/** 统计待索引（indexStatus==='pending'）数量，走索引 count，O(索引)不反序列化。 */
export async function countUnindexed(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('bookmarks', 'readonly')
    const idx = t.objectStore('bookmarks').index('by-indexStatus')
    const req = idx.count(IDBKeyRange.only('pending'))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** @deprecated 保留兼容旧调用；新路径用 getUnindexedBatch。走索引取 'pending'。 */
export async function getPendingIndexBookmarks(): Promise<Bookmark[]> {
  return getUnindexedBatch(Number.MAX_SAFE_INTEGER)
}
