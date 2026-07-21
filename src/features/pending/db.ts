// 待确认表（pending）CRUD + confirmPending（pending → bookmark）。
// 跨表操作（applyIndex / findByUrl）见 shared/db。

import { openDB, tx } from '@/shared/db/connection'
import type { Bookmark, PendingBookmark } from '@/shared/db/types'

export function addPending(item: PendingBookmark): Promise<IDBValidKey> {
  return tx('pending', 'readwrite', (s) => s.add(item))
}

export function getAllPending(): Promise<PendingBookmark[]> {
  return tx('pending', 'readonly', (s) => s.getAll() as IDBRequest<PendingBookmark[]>)
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction('pending', 'readonly').objectStore('pending').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function deletePending(id: string): Promise<undefined> {
  return tx('pending', 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>)
}

export async function updatePending(
  id: string,
  patch: Partial<PendingBookmark>,
): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('pending', 'readwrite')
    const s = t.objectStore('pending')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const cur = getReq.result as PendingBookmark | undefined
      if (!cur) return reject(new Error(`pending ${id} not found`))
      const next = { ...cur, ...patch }
      const putReq = s.put(next)
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// ───── Confirm pending → move to bookmarks ─────

export async function confirmPending(
  id: string,
  folderId: string | null = null,
): Promise<Bookmark> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['pending', 'bookmarks'], 'readwrite')
    const pStore = t.objectStore('pending')
    const bStore = t.objectStore('bookmarks')
    const getReq = pStore.get(id)
    getReq.onsuccess = () => {
      const p = getReq.result as PendingBookmark | undefined
      if (!p) return reject(new Error(`pending ${id} not found`))
      const bookmark: Bookmark = {
        id: p.id,
        url: p.url,
        title: p.title,
        favicon: p.favicon,
        domain: p.domain,
        summary: p.summary,
        tags: p.tags,
        contentType: p.contentType,
        folderId,
        pinnedIn: [],
        createdAt: p.createdAt,
        lastOpenedAt: p.createdAt,
        indexStatus: p.indexStatus,
        order: Date.now(),
      }
      bStore.add(bookmark)
      pStore.delete(id)
      t.oncomplete = () => resolve(bookmark)
      t.onerror = () => reject(t.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}
