import { useCallback, useState } from 'react'
import { runImport, type ImportProgress } from '../lib/importer'
import { useBookmarkStore } from '@/features/bookmarks'
import { MSG, broadcast } from '@/shared/messages'

export type { ImportProgress }

export function useImport() {
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [running, setRunning] = useState(false)

  const run = useCallback(async (html: string): Promise<ImportProgress> => {
    setRunning(true)
    try {
      const final = await runImport(html, { onProgress: setProgress })
      await useBookmarkStore.getState().hydrate()
      // 导入完成 → 立即通知 SW 开始批量索引，不等 30s alarm
      if (final.written > 0) {
        broadcast({ type: MSG.triggerDrain })
      }
      return final
    } finally {
      setRunning(false)
    }
  }, [])

  const reset = useCallback(() => setProgress(null), [])

  return { run, reset, progress, running }
}
