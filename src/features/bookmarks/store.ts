import { create } from 'zustand'
import { type Bookmark, type Folder, scopeKey } from '@/shared/db'
import {
  deleteBookmark as dbDeleteBookmark,
  getAllBookmarks,
  moveBookmark as dbMoveBookmark,
  reorderBookmarks as dbReorder,
  togglePin as dbTogglePin,
  touchOpened as dbTouchOpened,
} from './db'
import {
  addFolder as dbAddFolder,
  deleteFolder as dbDeleteFolder,
  getAllFolders,
  renameFolder as dbRenameFolder,
} from '@/features/sidebar/db'
import { MSG, type Message } from '@/shared/messages'

export type ContentTypeFilter = 'all' | '文章' | '视频' | '工具' | '文档' | '其他'
export type SortKey = 'recent' | 'oldest' | 'alpha' | 'manual'
/** 'all' = 全部；null = 未分类；string = 文件夹 id */
export type FolderScope = 'all' | null | string

interface BookmarkState {
  bookmarks: Bookmark[]
  folders: Folder[]
  loading: boolean
  filter: ContentTypeFilter
  sort: SortKey
  activeFolderId: FolderScope

  hydrate: () => Promise<void>
  hydrateFolders: () => Promise<void>
  setFilter: (f: ContentTypeFilter) => void
  setSort: (s: SortKey) => void
  setActiveFolder: (f: FolderScope) => void

  remove: (id: string) => Promise<void>
  togglePinned: (id: string) => Promise<void>
  reorder: (ids: string[]) => Promise<void>
  touch: (id: string) => Promise<void>
  moveToFolder: (id: string, folderId: string | null) => Promise<void>

  addFolder: (name: string) => Promise<Folder>
  renameFolder: (id: string, name: string) => Promise<void>
  removeFolder: (id: string) => Promise<void>
}

export const useBookmarkStore = create<BookmarkState>((set, get) => ({
  bookmarks: [],
  folders: [],
  loading: true,
  filter: 'all',
  sort: 'recent',
  activeFolderId: 'all',

  hydrate: async () => {
    // 仅首次加载显示 skeleton；后续 re-hydrate 静默更新数据，避免闪动
    const isInitial = get().bookmarks.length === 0 && get().loading
    if (isInitial) set({ loading: true })
    const [list, folders] = await Promise.all([getAllBookmarks(), getAllFolders()])
    set({ bookmarks: list, folders, loading: false })
  },

  hydrateFolders: async () => {
    const folders = await getAllFolders()
    set({ folders })
  },

  setFilter: (f) => set({ filter: f }),
  setSort: (s) => set({ sort: s }),
  setActiveFolder: (f) => set({ activeFolderId: f }),

  remove: async (id) => {
    await dbDeleteBookmark(id)
    set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }))
  },

  togglePinned: async (id) => {
    const cur = get().bookmarks.find((b) => b.id === id)
    if (!cur) return
    const key = scopeKey(get().activeFolderId)
    const next = await dbTogglePin(id, key)
    set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? next : b)) }))
  },

  reorder: async (ids) => {
    const map = await dbReorder(ids)
    set((s) => ({
      bookmarks: s.bookmarks.map((b) => {
        const o = map.get(b.id)
        return o != null ? { ...b, order: o } : b
      }),
    }))
  },

  touch: async (id) => {
    const next = await dbTouchOpened(id)
    set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? next : b)) }))
  },

  moveToFolder: async (id, folderId) => {
    const next = await dbMoveBookmark(id, folderId)
    set((s) => ({ bookmarks: s.bookmarks.map((b) => (b.id === id ? next : b)) }))
  },

  addFolder: async (name) => {
    const f = await dbAddFolder(name)
    set((s) => ({ folders: [...s.folders, f] }))
    return f
  },

  renameFolder: async (id, name) => {
    const f = await dbRenameFolder(id, name)
    set((s) => ({ folders: s.folders.map((x) => (x.id === id ? f : x)) }))
  },

  removeFolder: async (id) => {
    await dbDeleteFolder(id)
    set((s) => ({
      folders: s.folders.filter((x) => x.id !== id),
      bookmarks: s.bookmarks.map((b) => (b.folderId === id ? { ...b, folderId: null } : b)),
      activeFolderId: s.activeFolderId === id ? 'all' : s.activeFolderId,
    }))
  },
}))

// ───── Runtime 消息订阅 ─────

let subscribed = false
let hydrateTimer: ReturnType<typeof setTimeout> | null = null

export function subscribeBookmarkMessages(): void {
  if (subscribed) return
  subscribed = true
  chrome.runtime.onMessage.addListener((msg: Message) => {
    if (!msg || typeof msg !== 'object') return
    if (msg.type === MSG.bookmarkAdded || msg.type === MSG.bookmarkChanged) {
      // debounce: 300ms 内多条消息只触发一次 hydrate，避免批量索引时连续重渲染
      if (hydrateTimer) clearTimeout(hydrateTimer)
      hydrateTimer = setTimeout(() => {
        hydrateTimer = null
        void useBookmarkStore.getState().hydrate()
      }, 300)
    }
  })
}
