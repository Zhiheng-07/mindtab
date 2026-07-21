// IndexedDB 连接与事务基础设施。
// 这是唯一的 indexedDB.open 出口——组件 / feature 一律通过 openDB / tx 访问，
// 禁止在别处直接调用 indexedDB.open。

const DB_NAME = 'mindtab'
const DB_VERSION = 3

let dbPromise: Promise<IDBDatabase> | null = null

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      const txn = req.transaction!
      if (!db.objectStoreNames.contains('bookmarks')) {
        const s = db.createObjectStore('bookmarks', { keyPath: 'id' })
        s.createIndex('by-url', 'url', { unique: false })
        s.createIndex('by-folderId', 'folderId', { unique: false })
        s.createIndex('by-createdAt', 'createdAt', { unique: false })
      } else {
        // v1 → v2: isPinned (boolean) → pinnedIn (string[])
        const s = txn.objectStore('bookmarks')
        if (s.indexNames.contains('by-isPinned')) s.deleteIndex('by-isPinned')
        const cursorReq = s.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return
          const b = cursor.value as Record<string, unknown>
          if (typeof b.isPinned === 'boolean') {
            b.pinnedIn = b.isPinned ? ['all'] : []
            delete b.isPinned
            cursor.update(b)
          } else if (!Array.isArray(b.pinnedIn)) {
            b.pinnedIn = []
            cursor.update(b)
          }
          cursor.continue()
        }
      }

      // v3: bookmarks 加 by-indexStatus 索引（drain / 重试走索引取待办，不再全表扫）。
      // 独立幂等段：无论新装(上面 if 建 store)还是升级(else)，都在此统一确保索引存在。
      // createIndex 会自动回填现有 records，无需手写游标迁移。
      {
        const s = txn.objectStore('bookmarks')
        if (!s.indexNames.contains('by-indexStatus')) {
          s.createIndex('by-indexStatus', 'indexStatus', { unique: false })
        }
      }

      if (!db.objectStoreNames.contains('pending')) {
        const s = db.createObjectStore('pending', { keyPath: 'id' })
        s.createIndex('by-url', 'url', { unique: false })
        s.createIndex('by-createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains('folders')) {
        const s = db.createObjectStore('folders', { keyPath: 'id' })
        s.createIndex('by-parentId', 'parentId', { unique: false })
      }
    }
    req.onblocked = () => {
      // 其它 tab 持有旧版本连接 → 升级被阻塞。多 tab 打开 newtab 时可能发生。
      console.warn('[MindTab] DB upgrade blocked: 有其它标签页持有旧连接，请关闭后重试')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

export function tx<T>(
  store: 'bookmarks' | 'pending' | 'folders',
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | IDBRequest<T>[],
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const req = fn(s)
        const single = !Array.isArray(req) ? req : req[req.length - 1]
        single.onsuccess = () => resolve(single.result)
        single.onerror = () => reject(single.error)
        t.onerror = () => reject(t.error)
      }),
  )
}
