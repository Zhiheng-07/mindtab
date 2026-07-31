import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { set as storageSet, STORAGE_KEYS } from '@/shared/storage'
import { CURRENT_VERSION } from '../lib/whatsNew'

interface UpdateItem {
  emoji: string
  title: string
  desc: string
}

const UPDATES: UpdateItem[] = [
  {
    emoji: '🔍',
    title: 'AI 搜索全面可用',
    desc: '中转服务器架构升级，中国大陆网络环境下 AI 搜索正常工作。',
  },
  {
    emoji: '⚡',
    title: '导入大量书签更快',
    desc: 'AI 索引引擎重写为滑动窗口并发池 + 索引游标，大批量导入时索引耗时大幅缩短。',
  },
  {
    emoji: '🏗️',
    title: '架构升级',
    desc: '底层代码全面重构为模块化架构，提升稳定性与响应速度。',
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export function WhatsNewModal({ open, onClose }: Props) {
  const handleClose = async () => {
    await storageSet(STORAGE_KEYS.lastSeenVersion, CURRENT_VERSION)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            MindTab V{CURRENT_VERSION} 更新
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {UPDATES.map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="text-xl shrink-0">{item.emoji}</span>
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={handleClose} className="w-full mt-2">
          知道了
        </Button>
      </DialogContent>
    </Dialog>
  )
}

