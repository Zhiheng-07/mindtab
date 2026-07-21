// 跨表操作：同时触及多张 object store，不归属任何单一 feature。
// - applyIndex 被 shared/lib/aiIndex 调用（shared 不能依赖 features），故放在 shared。
// - findByUrl / clearAllData 跨表，无单一 feature 归属。
// confirmPending（pending → bookmark）属于 pending 生命周期，放在 features/pending/db.ts。

import { openDB } from './connection'
import type { Bookmark, PendingBookmark } from './types'

// ───── 跨表索引写入 ─────
// pending 和 bookmark 共享 UUID，索引完成时不确定记录在哪张表里。
// 先尝试 pending，没命中再 bookmarks。返回命中的表名供上层广播对应消息。

// applyIndex 内部用的 get→put 辅助：记录不存在时 reject，与各 feature 的
// updatePending / updateBookmark 行为一致，使下方 try/catch 的回退语义保持不变。
function putPatch(
  store: 'pending' | 'bookmarks',
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(store, 'readwrite')
        const s = t.objectStore(store)
        const getReq = s.get(id)
        getReq.onsuccess = () => {
          const cur = getReq.result as Record<string, unknown> | undefined
          if (!cur) return reject(new Error(`${store} ${id} not found`))
          const next = store === 'bookmarks' ? { ...cur, ...patch, id: cur.id } : { ...cur, ...patch }
          const putReq = s.put(next)
          putReq.onsuccess = () => resolve()
          putReq.onerror = () => reject(putReq.error)
        }
        getReq.onerror = () => reject(getReq.error)
      }),
  )
}

export async function applyIndex(
  id: string,
  patch: Partial<PendingBookmark> & Partial<Bookmark>,
): Promise<'pending' | 'bookmark' | null> {
  try {
    await putPatch('pending', id, patch as Record<string, unknown>)
    return 'pending'
  } catch {
    // not in pending
  }
  try {
    await putPatch('bookmarks', id, patch as Record<string, unknown>)
    return 'bookmark'
  } catch {
    return null
  }
}

// ───── Cross-table dedupe ─────

export async function findByUrl(
  url: string,
): Promise<{ kind: 'pending' | 'bookmark'; id: string } | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['pending', 'bookmarks'], 'readonly')
    const pReq = t.objectStore('pending').index('by-url').getKey(url)
    const bReq = t.objectStore('bookmarks').index('by-url').getKey(url)
    t.oncomplete = () => {
      if (pReq.result) resolve({ kind: 'pending', id: String(pReq.result) })
      else if (bReq.result) resolve({ kind: 'bookmark', id: String(bReq.result) })
      else resolve(null)
    }
    t.onerror = () => reject(t.error)
  })
}

// ───── 全量清空（设置 → 清空所有数据）─────

export async function clearAllData(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['bookmarks', 'pending', 'folders'], 'readwrite')
    t.objectStore('bookmarks').clear()
    t.objectStore('pending').clear()
    t.objectStore('folders').clear()
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
