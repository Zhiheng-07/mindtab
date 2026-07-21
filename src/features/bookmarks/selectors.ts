// 书签派生计算（纯函数，在组件内用 useMemo 调用）。
// 不持有状态，只对 store 给出的 bookmarks/folders 做投影。

import { type Bookmark, type Folder, scopeKey } from '@/shared/db'
import type { ContentTypeFilter, SortKey, FolderScope } from './store'

/** 给定父文件夹 id，返回它自己 + 所有后代 id 的集合 */
function descendantSet(folderId: string, folders: Folder[]): Set<string> {
  const set = new Set<string>([folderId])
  // 构建 parent -> children 索引（一次性 O(n)）
  const byParent = new Map<string, string[]>()
  for (const f of folders) {
    if (!f.parentId) continue
    const list = byParent.get(f.parentId) ?? []
    list.push(f.id)
    byParent.set(f.parentId, list)
  }
  const queue = [folderId]
  while (queue.length) {
    const cur = queue.shift()!
    const kids = byParent.get(cur)
    if (!kids) continue
    for (const k of kids) {
      if (!set.has(k)) {
        set.add(k)
        queue.push(k)
      }
    }
  }
  return set
}

function inScope(b: Bookmark, scope: FolderScope, folders: Folder[]): boolean {
  if (scope === 'all') return true
  if (scope === null) return b.folderId === null
  // 字符串 scope：递归命中后代
  const set = descendantSet(scope, folders)
  return b.folderId != null && set.has(b.folderId)
}

export function computePinned(
  bookmarks: Bookmark[],
  scope: FolderScope,
  folders: Folder[],
): Bookmark[] {
  return bookmarks
    .filter((b) => (b.pinnedIn ?? []).includes(scopeKey(scope)) && inScope(b, scope, folders))
    .sort((a, b) => b.order - a.order)
}

export function computeVisible(
  bookmarks: Bookmark[],
  filter: ContentTypeFilter,
  sort: SortKey,
  scope: FolderScope,
  folders: Folder[],
): Bookmark[] {
  const list = bookmarks.filter((b) => !(b.pinnedIn ?? []).includes(scopeKey(scope)) && inScope(b, scope, folders))
  const filtered =
    filter === 'all' ? list : list.filter((b) => b.contentType === filter)
  const sorted = [...filtered]
  if (sort === 'manual') sorted.sort((a, b) => b.order - a.order)
  else if (sort === 'recent') sorted.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
  else if (sort === 'oldest') sorted.sort((a, b) => a.createdAt - b.createdAt)
  else sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
  return sorted
}

/**
 * 每个文件夹的计数 = 该文件夹自己 + 所有后代下的书签总数。
 * unfiled = folderId 为 null 的书签数。
 */
export function countByFolder(
  bookmarks: Bookmark[],
  folders: Folder[],
): { all: number; unfiled: number; byFolder: Record<string, number> } {
  const direct: Record<string, number> = {}
  let unfiled = 0
  for (const b of bookmarks) {
    if (b.folderId == null) unfiled++
    else direct[b.folderId] = (direct[b.folderId] ?? 0) + 1
  }
  // 把每个文件夹的 direct 加到自己 + 所有祖先上
  const byId = new Map(folders.map((f) => [f.id, f]))
  const byFolder: Record<string, number> = {}
  for (const f of folders) byFolder[f.id] = 0
  for (const f of folders) {
    const n = direct[f.id] ?? 0
    if (n === 0) continue
    let cur: Folder | undefined = f
    while (cur) {
      byFolder[cur.id] = (byFolder[cur.id] ?? 0) + n
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
  }
  return { all: bookmarks.length, unfiled, byFolder }
}
