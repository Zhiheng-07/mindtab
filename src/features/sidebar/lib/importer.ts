// Chrome HTML 书签导入的纯函数实现（不依赖 React）
// useImport hook 和 SettingsPage 都复用这里。

import { faviconUrl } from '@/shared/lib/favicon'
import { findByUrl, type Bookmark, type Folder } from '@/shared/db'
import { addBookmark, updateBookmark } from '@/features/bookmarks/db'
import {
  addFolder,
  deleteEmptyFolders,
  findFolderByNameUnderParent,
  getAllFolders,
} from '../db'
import { parseBookmarkHtml } from './bookmarkParser'

const MAX_ITEMS = 2000

export interface ImportProgress {
  total: number
  written: number
  reassigned: number
  skipped: number
  failed: number
  done: boolean
}

export interface ImportOptions {
  onProgress?: (p: ImportProgress) => void
}

export async function runImport(
  html: string,
  opts: ImportOptions = {},
): Promise<ImportProgress> {
  const items = parseBookmarkHtml(html).slice(0, MAX_ITEMS)
  let written = 0
  let reassigned = 0
  let skipped = 0
  let failed = 0

  opts.onProgress?.({
    total: items.length,
    written: 0,
    reassigned: 0,
    skipped: 0,
    failed: 0,
    done: false,
  })

  const folderPool: Folder[] = await getAllFolders()
  const byPath = new Map<string, Folder>()

  const ensureFolderPath = async (path: string[]): Promise<Folder | null> => {
    if (path.length === 0) return null
    const key = path.join('')
    const cached = byPath.get(key)
    if (cached) return cached
    const parent =
      path.length > 1 ? await ensureFolderPath(path.slice(0, -1)) : null
    const name = path[path.length - 1]
    let folder = findFolderByNameUnderParent(name, parent?.id ?? null, folderPool)
    if (!folder) {
      folder = await addFolder(name, parent?.id ?? null)
      folderPool.push(folder)
    }
    byPath.set(key, folder)
    return folder
  }

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    try {
      const f = await ensureFolderPath(it.folderPath)
      const folderId = f?.id ?? null
      const dup = await findByUrl(it.url)
      if (dup) {
        if (dup.kind === 'bookmark') {
          await updateBookmark(dup.id, { folderId })
          reassigned++
        } else {
          skipped++
        }
      } else {
        const domain = safeHost(it.url)
        const bookmark: Bookmark = {
          id: crypto.randomUUID(),
          url: it.url,
          title: it.title || domain,
          favicon: faviconUrl(domain),
          domain,
          summary: '',
          tags: [],
          contentType: '',
          folderId,
          pinnedIn: [],
          createdAt: it.addedAt,
          lastOpenedAt: it.addedAt,
          indexStatus: 'pending',
          order: Date.now() + i,
        }
        await addBookmark(bookmark)
        written++
      }
    } catch (e) {
      console.warn('[MindTab] import item failed:', it.url, (e as Error).message)
      failed++
    }
    if ((i + 1) % 25 === 0) {
      opts.onProgress?.({
        total: items.length,
        written,
        reassigned,
        skipped,
        failed,
        done: false,
      })
    }
  }

  await deleteEmptyFolders()

  const final: ImportProgress = {
    total: items.length,
    written,
    reassigned,
    skipped,
    failed,
    done: true,
  }
  opts.onProgress?.(final)
  return final
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}
