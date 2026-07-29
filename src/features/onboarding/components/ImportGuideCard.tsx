// 首次安装在主区域顶部展示一次。
// 关闭后写 chrome.storage 标记，永远不再出现。

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  get as storageGet,
  set as storageSet,
  STORAGE_KEYS,
} from '@/shared/storage'
import { IconClose } from '@/shared/ui/icons'
import { useImport } from '@/features/sidebar'
import { useToastStore } from '@/features/toast'

export function ImportGuideCard() {
  const [visible, setVisible] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const { run } = useImport()
  const pushToast = useToastStore((s) => s.pushToast)

  useEffect(() => {
    void storageGet<boolean>(STORAGE_KEYS.importGuideShown, false).then((shown) => {
      if (!shown) setVisible(true)
    })
  }, [])

  const dismiss = async () => {
    setVisible(false)
    await storageSet(STORAGE_KEYS.importGuideShown, true)
  }

  const handleImportClick = () => fileRef.current?.click()

  const handleImportFile = async (file: File) => {
    try {
      const html = await file.text()
      const { written, reassigned, skipped } = await run(html)
      if (written > 0) {
        pushToast('success', `导入：新增 ${written} 条，重新归类 ${reassigned}`, 'import-guide')
      } else if (skipped > 0) {
        pushToast('info', `全部跳过：${skipped} 条已存在`, 'import-guide')
      } else {
        pushToast('error', '未解析到可导入条目', 'import-no-items')
      }
    } catch (e) {
      pushToast('error', `导入失败：${(e as Error).message}`, 'import-guide-fail')
    } finally {
      void dismiss()
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div
            className="glass glass-border"
            style={{
              borderRadius: 'var(--mt-radius-2xl)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--mt-text-strong)' }}>
                把已有书签搬过来
              </div>
              <div style={{ fontSize: 12, color: 'var(--mt-text-muted)' }}>
                从 Chrome/Edge 导出 HTML（书签管理器 → 导出书签），一键迁移文件夹结构
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,text/html"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void handleImportFile(f)
              }}
            />
            <button
              onClick={handleImportClick}
              style={{
                padding: '8px 14px',
                background: 'var(--mt-accent)',
                color: 'var(--mt-accent-fg)',
                border: 'none',
                borderRadius: 'var(--mt-radius-md)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              导入书签
            </button>
            <button
              aria-label="关闭引导"
              onClick={dismiss}
              style={{
                width: 28,
                height: 28,
                background: 'transparent',
                border: 'none',
                color: 'var(--mt-text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconClose size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
