// chrome.storage.local 类型化封装（通用读写）。
// 不存大数据（>100KB 走 IndexedDB）。

export async function get<T>(key: string, fallback: T): Promise<T> {
  const r = await chrome.storage.local.get(key)
  return (r[key] ?? fallback) as T
}

export async function set<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [key]: value })
}

export async function remove(key: string): Promise<void> {
  await chrome.storage.local.remove(key)
}

export function onChange<T>(
  key: string,
  cb: (newValue: T | undefined, oldValue: T | undefined) => void,
): () => void {
  const handler = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'local') return
    if (!(key in changes)) return
    cb(changes[key].newValue as T | undefined, changes[key].oldValue as T | undefined)
  }
  chrome.storage.onChanged.addListener(handler)
  return () => chrome.storage.onChanged.removeListener(handler)
}
