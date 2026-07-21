// 导出书签为 Netscape Bookmark File 格式 HTML
// 兼容 Chrome / Firefox / Safari 的导入功能。

import { type Bookmark, type Folder } from '@/shared/db'
import { getAllBookmarks } from '@/features/bookmarks/db'
import { getAllFolders } from '../db'

/**
 * 生成 Netscape Bookmark HTML 并触发浏览器下载。
 * 返回导出的书签总数。
 */
export async function exportBookmarksHtml(): Promise<number> {
  const bookmarks = await getAllBookmarks()
  const folders = await getAllFolders()

  if (bookmarks.length === 0) return 0

  // 按 folderId 分组
  const folderMap = new Map<string, Folder>()
  for (const f of folders) folderMap.set(f.id, f)

  const byFolder = new Map<string | null, Bookmark[]>()
  for (const b of bookmarks) {
    const key = b.folderId ?? null
    const arr = byFolder.get(key)
    if (arr) arr.push(b)
    else byFolder.set(key, [b])
  }

  // 构建 HTML
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file by MindTab. -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>MindTab Bookmarks</TITLE>',
    '<H1>MindTab Bookmarks</H1>',
    '<DL><p>',
  ]

  // 递归渲染文件夹树
  const rendered = new Set<string>()

  function renderFolder(folderId: string, indent: number) {
    if (rendered.has(folderId)) return
    rendered.add(folderId)
    const folder = folderMap.get(folderId)
    if (!folder) return

    const pad = '    '.repeat(indent)
    const ts = Math.floor(folder.createdAt / 1000)
    lines.push(`${pad}<DT><H3 ADD_DATE="${ts}">${esc(folder.name)}</H3>`)
    lines.push(`${pad}<DL><p>`)

    // 子文件夹
    const children = folders
      .filter((f) => f.parentId === folderId)
      .sort((a, b) => a.order - b.order)
    for (const child of children) {
      renderFolder(child.id, indent + 1)
    }

    // 该文件夹下的书签
    const items = byFolder.get(folderId) ?? []
    for (const b of items) {
      renderBookmark(b, indent + 1)
    }

    lines.push(`${pad}</DL><p>`)
  }

  function renderBookmark(b: Bookmark, indent: number) {
    const pad = '    '.repeat(indent)
    const ts = Math.floor(b.createdAt / 1000)
    const icon = b.favicon ? ` ICON="${esc(b.favicon)}"` : ''
    lines.push(`${pad}<DT><A HREF="${esc(b.url)}" ADD_DATE="${ts}"${icon}>${esc(b.title)}</A>`)
  }

  // 先渲染顶层文件夹
  const topFolders = folders
    .filter((f) => !f.parentId)
    .sort((a, b) => a.order - b.order)
  for (const f of topFolders) {
    renderFolder(f.id, 1)
  }

  // 未分类书签
  const unfiled = byFolder.get(null) ?? []
  if (unfiled.length > 0) {
    for (const b of unfiled) {
      renderBookmark(b, 1)
    }
  }

  lines.push('</DL><p>')

  // 触发下载
  const html = lines.join('\n')
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mindtab-bookmarks-${new Date().toISOString().slice(0, 10)}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return bookmarks.length
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
