// MindTab 本地数据库的领域类型
// 三个对象仓库：bookmarks / pending / folders 共用这里的类型定义。

export type IndexStatus = 'indexing' | 'pending' | 'done'

export interface Bookmark {
  id: string
  url: string
  title: string
  favicon: string
  domain: string
  summary: string
  tags: string[]
  contentType: string
  folderId: string | null
  pinnedIn: string[]
  createdAt: number
  lastOpenedAt: number
  indexStatus: IndexStatus
  order: number
}

export interface PendingBookmark {
  id: string
  url: string
  title: string
  favicon: string
  domain: string
  summary: string
  tags: string[]
  contentType: string
  createdAt: number
  indexStatus: IndexStatus
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: number
}

/** 将 FolderScope 映射为可存入 pinnedIn 数组的字符串 key */
export function scopeKey(scope: 'all' | null | string): string {
  if (scope === null) return '__unfiled__'
  return scope
}
