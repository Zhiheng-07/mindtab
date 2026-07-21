import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LottieMenuIcon } from './LottieMenuIcon'
import { IconPlusSquare, IconDownload, IconTrash2 } from '@/shared/ui/icons'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { useConfirm } from '@/shared/ui/ConfirmModal'
import {
  countByFolder,
  useBookmarkStore,
  type FolderScope,
} from '@/features/bookmarks'
import { useToastStore } from '@/features/toast'
import { useThemeStore } from '@/features/theme'
import logoDark from '@/assets/logo-dark.svg'
import logoLight from '@/assets/logo-light.svg'
import { useImport } from '../hooks/useImport'
import { type Folder } from '@/shared/db'
import { deleteEmptyFolders } from '../db'
import { AddFolderModal } from './AddFolderModal'
import { FolderItem } from './FolderItem'
import { FolderTreeItem } from './FolderTreeItem'
import { RenameFolderModal } from './RenameFolderModal'

// 规范 5.6.4：侧导栏宽度 220px
export const SIDEBAR_WIDTH = 220

interface Props {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: Props) {
  const folders = useBookmarkStore((s) => s.folders)
  const bookmarks = useBookmarkStore((s) => s.bookmarks)
  const activeFolderId = useBookmarkStore((s) => s.activeFolderId)
  const setActiveFolder = useBookmarkStore((s) => s.setActiveFolder)
  const renameFolder = useBookmarkStore((s) => s.renameFolder)
  const removeFolder = useBookmarkStore((s) => s.removeFolder)
  const pushToast = useToastStore((s) => s.pushToast)
  const effectiveTheme = useThemeStore((s) => s.effective)

  const counts = useMemo(() => countByFolder(bookmarks, folders), [bookmarks, folders])
  const fileRef = useRef<HTMLInputElement>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null)
  const confirm = useConfirm()
  const { run, running, progress } = useImport()

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>()
    for (const f of folders) {
      const key = (f.parentId ?? null) as string | null
      const list = map.get(key) ?? []
      list.push(f)
      map.set(key, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order - b.order)
    }
    return map
  }, [folders])

  const topLevel = childrenByParent.get(null) ?? []
  const childrenOf = (parentId: string): Folder[] =>
    childrenByParent.get(parentId) ?? []
  const childCount = (folderId: string): number => counts.byFolder[folderId] ?? 0

  const handlePick = (f: FolderScope) => setActiveFolder(f)

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  const handleRename = (id: string, oldName: string) => {
    setRenameTarget({ id, name: oldName })
  }

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: `删除文件夹「${name}」？`,
      description: '其中的书签会移到「未分类」，子文件夹会被清空。',
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    try {
      await removeFolder(id)
      pushToast('success', '已删除')
    } catch (e) {
      pushToast('error', `删除失败：${(e as Error).message}`)
    }
  }

  const handleImport = async (file: File) => {
    const text = await file.text()
    const result = await run(text)
    const reMsg = result.reassigned > 0 ? `，重新归类 ${result.reassigned}` : ''
    if (result.failed === 0 && (result.written > 0 || result.reassigned > 0)) {
      pushToast('success', `已导入 ${result.written} 条${reMsg}（跳过 ${result.skipped}）`)
    } else if (result.written > 0 || result.reassigned > 0) {
      pushToast('warning', `成功 ${result.written}${reMsg}，失败 ${result.failed}`)
    } else if (result.skipped > 0) {
      pushToast('info', `全部跳过：${result.skipped} 条已存在且分类未变`)
    } else {
      pushToast('error', '未解析到可导入条目')
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            key="sidebar"
            initial={{ x: -SIDEBAR_WIDTH }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_WIDTH }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            className="glass glass-border fixed top-0 left-0 bottom-0 z-50 flex flex-col"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-3">
              <img
                src={effectiveTheme === 'dark' ? logoLight : logoDark}
                alt="MindTab"
                className="w-7 h-7"
              />
              <span className="font-semibold text-sm flex-1">MindTab</span>
              <button
                aria-label="收起侧导栏"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LottieMenuIcon open={open} size={18} />
              </button>
            </div>

            {/* Folders */}
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-0.5 p-2">
                <FolderItem
                  label="全部"
                  count={counts.all}
                  active={activeFolderId === 'all'}
                  onClick={() => handlePick('all')}
                />
                <FolderItem
                  label="未分类"
                  count={counts.unfiled}
                  active={activeFolderId === null}
                  droppable
                  droppableId="folder:"
                  onClick={() => handlePick(null)}
                />
                {(bookmarks.length > 0 || topLevel.length > 0) && (
                  <>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 mt-3 mb-1">
                      文件夹
                    </div>
                    {topLevel.length === 0 && (
                      <div className="text-xs text-muted-foreground px-2 py-1.5">
                        暂无文件夹
                      </div>
                    )}
                  </>
                )}
                {topLevel.map((f) => (
                  <FolderTreeItem
                    key={f.id}
                    folder={f}
                    count={childCount(f.id)}
                    children={childrenOf(f.id)}
                    childCount={childCount}
                    childrenOf={childrenOf}
                    active={typeof activeFolderId === 'string' ? activeFolderId : null}
                    onSelect={(id) => handlePick(id)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Footer actions */}
            <div className="flex flex-col gap-0.5 p-2">
              <FooterAction onClick={() => setAddOpen(true)}>
                <IconPlusSquare size={14} /> 添加文件夹
              </FooterAction>
              <FooterAction onClick={() => fileRef.current?.click()} disabled={running}>
                <IconDownload size={14} />
                {running
                  ? `导入中… ${progress?.written ?? 0}/${progress?.total ?? '?'}`
                  : '导入书签 HTML'}
              </FooterAction>
              <FooterAction onClick={async () => {
                const n = await deleteEmptyFolders()
                if (n > 0) {
                  await useBookmarkStore.getState().hydrate()
                  pushToast('success', `已清理 ${n} 个空文件夹`)
                } else {
                  pushToast('info', '没有空文件夹')
                }
              }}>
                <IconTrash2 size={14} /> 清理空文件夹
              </FooterAction>
              <input
                ref={fileRef}
                type="file"
                accept=".html,.htm,text/html"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void handleImport(f)
                  e.target.value = ''
                }}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
      <AddFolderModal open={addOpen} onClose={() => setAddOpen(false)} />
      <RenameFolderModal
        open={renameTarget !== null}
        initial={renameTarget?.name ?? ''}
        onClose={() => setRenameTarget(null)}
        onSubmit={async (name) => {
          if (!renameTarget) return
          try {
            await renameFolder(renameTarget.id, name)
          } catch (e) {
            pushToast('error', `重命名失败：${(e as Error).message}`)
          }
        }}
      />
    </>
  )
}

// 让 Separator 在树状结构里可用
export { Separator as SidebarSeparator }

/* Footer 操作按钮 — 对齐 FolderTreeItem（padding 12px, gap 8, font 13） */
function FooterAction({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '8px 12px',
        borderRadius: 'var(--mt-radius-md)',
        border: 'none',
        background: hovered ? 'var(--mt-surface-hover)' : 'transparent',
        color: 'var(--mt-text-secondary)',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms ease',
      }}
    >
      {children}
    </button>
  )
}
