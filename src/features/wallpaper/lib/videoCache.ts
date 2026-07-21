// 视频缓存 — 基于 IndexedDB 存储大文件 blob
// 首次访问从远程下载并缓存，后续直接返回本地 blob URL（零网络延迟）

const DB_NAME = 'mindtab-video-cache'
const DB_VERSION = 1
const STORE_NAME = 'videos'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 从 IndexedDB 读取已缓存的视频 blob */
async function getCached(key: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const req = store.get(key)
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

/** 将 blob 写入 IndexedDB */
async function setCache(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.put(blob, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {
    // 写入失败不影响播放
  }
}

/**
 * 获取视频可用 URL：
 * 1. 已缓存 → 返回本地 blob URL（瞬时）
 * 2. 未缓存 → 返回远程 URL（立即可播）+ 后台静默下载缓存
 *
 * 返回 { url, fromCache }
 */
export async function getVideoUrl(
  remoteUrl: string,
): Promise<{ url: string; fromCache: boolean }> {
  // 尝试读缓存
  const cached = await getCached(remoteUrl)
  if (cached) {
    const blobUrl = URL.createObjectURL(cached)
    return { url: blobUrl, fromCache: true }
  }

  // 未缓存：先返回远程 URL，后台静默下载
  void cacheInBackground(remoteUrl)
  return { url: remoteUrl, fromCache: false }
}

/** 后台静默下载并缓存到 IndexedDB */
async function cacheInBackground(remoteUrl: string): Promise<void> {
  try {
    const res = await fetch(remoteUrl)
    if (!res.ok) return
    const blob = await res.blob()
    await setCache(remoteUrl, blob)
    console.log(`[MindTab] video cached: ${(blob.size / 1024 / 1024).toFixed(1)}MB`)
  } catch (e) {
    console.warn('[MindTab] video cache failed:', remoteUrl, (e as Error).message)
  }
}

/** 清除所有视频缓存（设置面板可调用） */
export async function clearVideoCache(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
  } catch {
    // ignore
  }
}
