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
    emoji: '🔑',
    title: 'AI 改为绑定你自己的服务',
    desc: '商店版原有的内置 AI 额度停止提供，改用你自己的 API Key（设置 → AI 服务，12 家厂商可选）。绑定前书签、文件夹、待整理内容都完整保留，本地搜索照常可用。',
  },
  {
    emoji: '🔍',
    title: '搜索全面升级',
    desc: '输入即出结果，AI 精排提速一个数量级；中文搜索大幅改善，支持方向键选择。',
  },
  {
    emoji: '🖼',
    title: '网站图标修复',
    desc: '修复部分网站图标只显示首字母的问题。',
  },
  {
    emoji: '✨',
    title: '体验细节优化',
    desc: '通知不再刷屏、多标签页状态同步、背景视频加载提速、未配置 AI 时引导更清晰；新增 AI 绑定引导。',
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

