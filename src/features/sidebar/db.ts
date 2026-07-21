// 文件夹表（folders）CRUD。
// deleteFolder / deleteEmptyFolders 会级联更新 bookmarks，但归属点是文件夹，放这里。

import { openDB, tx } from '@/shared/db/connection'
import type { Bookmark, Folder } from '@/shared/db/types'

export function getAllFolders(): Promise<Folder[]> {
  return tx('folders', 'readonly', (s) => s.getAll() as IDBRequest<Folder[]>)
}

let _folderOrderSeq = 0
function nextOrder(): number {
  // 1ms 内多次调用也保证单调（高 16 位时间戳 + 低位计数器）
  return Date.now() * 1000 + (_folderOrderSeq++ % 1000)
}

export async function addFolder(
  name: string,
  parentId: string | null = null,
): Promise<Folder> {
  const folder: Folder = {
    id: crypto.randomUUID(),
    name: name.trim().slice(0, 8),
    parentId,
    order: nextOrder(),
    createdAt: Date.now(),
  }
  await tx('folders', 'readwrite', (s) => s.add(folder))
  return folder
}

// 查找同父级下的同名文件夹（用于去重 import 链路）
export function findFolderByNameUnderParent(
  name: string,
  parentId: string | null,
  pool: Folder[],
): Folder | undefined {
  const trimmed = name.trim().slice(0, 8)
  return pool.find((f) => f.name === trimmed && (f.parentId ?? null) === parentId)
}

export async function renameFolder(id: string, name: string): Promise<Folder> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('folders', 'readwrite')
    const s = t.objectStore('folders')
    const getReq = s.get(id)
    getReq.onsuccess = () => {
      const cur = getReq.result as Folder | undefined
      if (!cur) return reject(new Error(`folder ${id} not found`))
      const next: Folder = { ...cur, name: name.trim().slice(0, 8) }
      const putReq = s.put(next)
      putReq.onsuccess = () => resolve(next)
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// 清理空文件夹：0 直接书签 + 0 子文件夹 的全部删除。
// 多轮迭代直到稳定（删掉一层叶子可能让上一层变成新的叶子）。
export async function deleteEmptyFolders(): Promise<number> {
  let total = 0
  for (;;) {
    const folders = await getAllFolders()
    const db = await openDB()
    const usedAsParent = new Set<string>()
    for (const f of folders) if (f.parentId) usedAsParent.add(f.parentId)

    // 取所有 bookmark 所在 folderId
    const occupied = await new Promise<Set<string>>((resolve, reject) => {
      const set = new Set<string>()
      const req = db
        .transaction('bookmarks', 'readonly')
        .objectStore('bookmarks')
        .openCursor()
      req.onsuccess = () => {
        const c = req.result
        if (!c) return resolve(set)
        const fId = (c.value as Bookmark).folderId
        if (fId) set.add(fId)
        c.continue()
      }
      req.onerror = () => reject(req.error)
    })

    const toRemove = folders.filter(
      (f) => !usedAsParent.has(f.id) && !occupied.has(f.id),
    )
    if (toRemove.length === 0) break
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction('folders', 'readwrite')
      const s = t.objectStore('folders')
      for (const f of toRemove) s.delete(f.id)
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    })
    total += toRemove.length
  }
  return total
}

// 删文件夹：同时把里面的 bookmark.folderId 置 null（未分类）
export async function deleteFolder(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['folders', 'bookmarks'], 'readwrite')
    t.objectStore('folders').delete(id)
    const bs = t.objectStore('bookmarks')
    const idx = bs.index('by-folderId')
    const cursorReq = idx.openCursor(IDBKeyRange.only(id))
    cursorReq.onsuccess = () => {
      const c = cursorReq.result
      if (!c) return
      const v = c.value as Bookmark
      c.update({ ...v, folderId: null })
      c.continue()
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}
