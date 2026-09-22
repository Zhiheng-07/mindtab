// 首次安装的隐私授权弹窗（shadcn Dialog 实现）
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  open: boolean
  onAgree: () => void
  onDismiss: () => void
}

export function PrivacyModal({ open, onAgree, onDismiss }: Props) {
  const [agreed, setAgreed] = useState(true)
  const [privacyExpanded, setPrivacyExpanded] = useState(false)
  const [termsExpanded, setTermsExpanded] = useState(false)

  // 关闭时重置（渲染期间调整状态，替代 effect 重置）
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setAgreed(true)
      setPrivacyExpanded(false)
      setTermsExpanded(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onDismiss()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <div>
          <DialogHeader>
            <DialogTitle>欢迎使用 MindTab</DialogTitle>
          </DialogHeader>
          <DialogDescription className="mt-1.5">
            AI 原生书签管理扩展。所有数据存放在你的浏览器本地，仅在你触发 AI 整理或搜索时，才会把必要内容直接发送给你自己配置的 AI 服务商。
          </DialogDescription>
        </div>

        <Collapsible
          title="隐私政策"
          expanded={privacyExpanded}
          onToggle={() => setPrivacyExpanded((v) => !v)}
        >
          <ul className="text-xs leading-7 text-muted-foreground list-disc pl-5">
            <li>收藏内容（URL/标题/摘要）保存在 IndexedDB，不上传服务器</li>
            <li>设置项保存在 chrome.storage.local</li>
            <li>AI 索引/搜索请求从浏览器直接发送给你自己配置的 AI 服务商，MindTab 不设中转服务器</li>
            <li>不收集浏览历史，不上报个人信息</li>
          </ul>
        </Collapsible>

        <Collapsible
          title="用户协议"
          expanded={termsExpanded}
          onToggle={() => setTermsExpanded((v) => !v)}
        >
          <ul className="text-xs leading-7 text-muted-foreground list-disc pl-5">
            <li>合规使用：勿用 MindTab 收藏违反所在地法律的内容</li>
            <li>责任界定：网络/AI 异常导致的数据延迟由你自行评估</li>
            <li>V0.1 早期版本，后续更新需重新确认</li>
          </ul>
        </Collapsible>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="accent-primary"
          />
          已阅读并同意《隐私政策》和《用户协议》
        </label>

        <Button
          onClick={onAgree}
          disabled={!agreed}
          className="w-full"
        >
          开始使用
        </Button>
      </DialogContent>
    </Dialog>
  )
}

function Collapsible({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string
  expanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-medium hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'size-4 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {/* 始终挂载,用 grid-rows 0fr→1fr 平滑展开。
          保持挂载 → backdrop-filter 早已合成,border-t 不会在挂载首帧闪过亮线。 */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden" style={{ transform: 'translateZ(0)' }}>
          <div className="px-3.5 pb-3 pt-1 border-t" style={{ transform: 'translateZ(0)' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

