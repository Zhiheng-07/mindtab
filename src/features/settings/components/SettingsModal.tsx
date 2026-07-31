// 设置模态。分组：通用 / 数据 / 隐私 / 关于
// 视觉风格沿用 SearchModal 的底部弹出 + 蒙层。

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { clearAllData } from '@/shared/db'
import { getPendingIndexBookmarks } from '@/features/bookmarks/db'
import { exportBookmarksHtml, runImport } from '@/features/sidebar'
import { MSG } from '@/shared/messages'
import {
  get as storageGet,
  set as storageSet,
  STORAGE_KEYS,
} from '@/shared/storage'
import { useBookmarkStore } from '@/features/bookmarks'
import { usePendingStore } from '@/features/pending'
import { useToastStore } from '@/features/toast'
import { useThemeStore, type ThemeMode } from '@/features/theme'
import { useConfirm } from '@/shared/ui/ConfirmModal'
import { IconClose } from '@/shared/ui/icons'
import { Button } from '@/shared/ui/button'
import { Row, Section, Segmented } from './SettingsPrimitives'
import { AiSettingsSection } from './AiSettingsSection'

const VERSION = '0.2.6'

interface Props {
  open: boolean
  onClose: () => void
  /** 打开时自动滚动到 AI 服务区域并聚焦 API Key 输入框 */
  focusAi?: boolean
}

export function SettingsModal({ open, onClose, focusAi }: Props) {
  const mode = useThemeStore((s) => s.mode)
  const setMode = useThemeStore((s) => s.setMode)
  const pushToast = useToastStore((s) => s.pushToast)
  const confirm = useConfirm()
  const aiSectionRef = useRef<HTMLDivElement>(null)

  const [improve, setImprove] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [reindexBusy, setReindexBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void storageGet<boolean>(STORAGE_KEYS.improveProduct, true).then(setImprove)
  }, [open])

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [open, onClose])

  // focusAi：打开时自动滚动到 AI 服务区域并聚焦 API Key 输入框
  useEffect(() => {
    if (!focusAi || !open || !aiSectionRef.current) return
    const el = aiSectionRef.current
    const scrollTimer = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    // 等滚动完成后聚焦 API Key 输入框
    const focusTimer = setTimeout(() => {
      const input = el.querySelector('input[type="password"]')
      if (input instanceof HTMLElement) input.focus()
    }, 400)
    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(focusTimer)
    }
  }, [focusAi, open])

  const handleClearAll = async () => {
    const ok = await confirm({
      title: '清空所有数据？',
      description:
        '将删除全部书签、待确认项、文件夹与本地索引。此操作不可撤销。',
      confirmText: '确认清空',
      danger: true,
    })
    if (!ok) return
    try {
      await clearAllData()
      await useBookmarkStore.getState().hydrate()
      await usePendingStore.getState().hydratePending()
      pushToast('success', '已清空所有数据', 'clear-all')
    } catch (e) {
      pushToast('error', `清空失败：${(e as Error).message}`, 'clear-fail')
    }
  }

  const handleImproveToggle = async (next: boolean) => {
    setImprove(next)
    await storageSet(STORAGE_KEYS.improveProduct, next)
  }

  const handleReindex = async () => {
    setReindexBusy(true)
    try {
      const items = await getPendingIndexBookmarks()
      if (items.length === 0) {
        pushToast('info', '所有书签均已索引', 'reindex-none')
        return
      }
      await chrome.runtime.sendMessage({ type: MSG.retryIndex })
      pushToast('success', `已发起 ${items.length} 条重新索引`, 'reindex-start')
    } catch (e) {
      pushToast('error', `重新索引失败：${(e as Error).message}`, 'reindex-fail')
    } finally {
      setReindexBusy(false)
    }
  }

  const handleImportClick = () => fileRef.current?.click()

  const handleImportFile = async (file: File) => {
    setImportBusy(true)
    try {
      const html = await file.text()
      const result = await runImport(html)
      await useBookmarkStore.getState().hydrate()
      if (result.written > 0 || result.reassigned > 0) {
        pushToast(
          'success',
          `导入：新增 ${result.written} 条，重新归类 ${result.reassigned}`,
          'import-html'
        )
      } else if (result.skipped > 0) {
        pushToast('info', `全部跳过：${result.skipped} 条已存在`, 'import-html')
      } else {
        pushToast('error', '未解析到可导入条目', 'import-no-items')
      }
    } catch (e) {
      pushToast('error', `导入失败：${(e as Error).message}`, 'import-fail')
    } finally {
      setImportBusy(false)
    }
  }

  const handleExport = async () => {
    setExportBusy(true)
    try {
      const count = await exportBookmarksHtml()
      if (count > 0) {
        pushToast('success', `已导出 ${count} 条书签`, 'export-ok')
      } else {
        pushToast('info', '暂无书签可导出', 'export-none')
      }
    } catch (e) {
      pushToast('error', `导出失败：${(e as Error).message}`, 'export-fail')
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-mask"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          onMouseDown={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--mt-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 280,
          }}
        >
          <motion.div
            key="settings-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            className="glass-solid glass-border"
            style={{
              width: 'min(640px, 92vw)',
              maxHeight: '80vh',
              borderRadius: 'var(--mt-radius-3xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ── Header：固定在顶部，不随内容滚动 ── */}
            <header style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px 0',
              flexShrink: 0,
            }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--mt-text-strong)' }}>
                设置
              </h2>
              <button
                aria-label="关闭"
                onClick={onClose}
                className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100 cursor-pointer outline-none"
                style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <IconClose size={16} />
              </button>
            </header>

            {/* ── 可滚动内容区 ── */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}>
              {/* ── 通用 ── */}
              <Section title="通用">
                <Row label="深色模式">
                  <Segmented
                    value={mode}
                    options={[
                      { value: 'system', label: '跟随系统' },
                      { value: 'light', label: '亮' },
                      { value: 'dark', label: '暗' },
                    ]}
                    onChange={(v) => setMode(v as ThemeMode)}
                  />
                </Row>
                <Row label="帮助改善产品体验" hint="匿名上报使用统计，可随时关闭">
                  <Toggle value={improve} onChange={handleImproveToggle} />
                </Row>
              </Section>

              {/* ── AI 服务 ── */}
              <div ref={aiSectionRef}>
                <AiSettingsSection />
              </div>

              {/* ── 数据 ── */}
              <Section title="数据管理">
                <Row label="导入书签 HTML">
                  <Button variant="outline" size="sm" className="rounded-full active:scale-[0.96]" onClick={handleImportClick} disabled={importBusy}>
                    {importBusy ? '导入中…' : '选择文件'}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".html,.htm,text/html"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleImportFile(f)
                      e.target.value = ''
                    }}
                  />
                </Row>
                <Row label="导出书签 HTML">
                  <Button variant="outline" size="sm" className="rounded-full active:scale-[0.96]" onClick={handleExport} disabled={exportBusy}>
                    {exportBusy ? '导出中…' : '导出'}
                  </Button>
                </Row>
                <Row label="重新索引待索引项">
                  <Button variant="outline" size="sm" className="rounded-full active:scale-[0.96]" onClick={handleReindex} disabled={reindexBusy}>
                    {reindexBusy ? '请求中…' : '立即重试'}
                  </Button>
                </Row>
                <Row label="清空所有数据" hint="删除全部书签、文件夹与索引">
                  <Button variant="destructive" size="sm" className="rounded-full active:scale-[0.96]" onClick={handleClearAll}>
                    清空
                  </Button>
                </Row>
              </Section>

              {/* ── 隐私 ── */}
              <Section title="隐私">
                <Row label="数据存储位置" hint="收藏数据全部存放在你的浏览器本地（IndexedDB），不上传服务器" />
                <Row label="AI 调用范围" hint="仅在你触发收藏/搜索时调用 AI 生成摘要与标签，书签数据不会被存储在服务端" />
              </Section>

              {/* ── 关于 ── */}
              <Section title="关于">
                <Row label="MindTab" hint={`版本 ${VERSION}`} />
                <Row label="反馈渠道" hint="微信：zhihengaipm" />
              </Section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ───── 子组件 ─────
// Section / Row / Segmented 已提取到 ./SettingsPrimitives（与 AiSettingsSection 共用）。
// Toggle 仅本文件使用，保持私有。

function Toggle({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={
        value
          ? 'bg-[var(--mt-accent)] hover:opacity-85'
          : 'bg-[var(--mt-border-hover)] hover:bg-[var(--mt-text-placeholder)]'
      }
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        border: 'none',
        borderRadius: 'var(--mt-radius-pill)',
        cursor: 'pointer',
        transition: 'background 150ms ease, opacity 150ms ease',
        flex: '0 0 40px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          width: 16,
          height: 16,
          background: value ? 'var(--mt-toggle-knob)' : '#ffffff',
          borderRadius: '50%',
          transition: 'left 150ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}
