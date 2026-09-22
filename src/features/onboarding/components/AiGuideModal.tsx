// AI 绑定引导弹窗：新用户同意隐私后 / 升级用户看完版本更新后弹出一次（判定见 lib/aiGuide.ts）。
// 内嵌设置页同款 AI 配置表单（guide 形态）；保存成功或「稍后再说」均关闭。
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { AiSettingsSection } from '@/features/settings'

interface Props {
  open: boolean
  onClose: () => void
}

export function AiGuideModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto gap-4"
        onOpenAutoFocus={(e) => {
          // 默认会聚焦第一个可聚焦元素（服务商下拉）；改为聚焦 API Key 输入框，方便直接粘贴
          const keyInput = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLInputElement>(
            'input[type="password"]',
          )
          if (keyInput) {
            e.preventDefault()
            keyInput.focus()
          }
        }}
      >
        <div>
          <DialogHeader>
            <DialogTitle>绑定你的 AI 服务</DialogTitle>
          </DialogHeader>
          <DialogDescription className="mt-2 leading-6">
            MindTab 用 AI 自动整理书签、理解搜索意图。填入你自己的 API Key，请求会从浏览器直接发给你选的厂商，MindTab 不经手。暂时没有 Key 也没关系，收藏和本地搜索照常能用。
          </DialogDescription>
        </div>

        <AiSettingsSection variant="guide" onSaved={onClose} />

        <p className="text-xs text-muted-foreground -mt-1">
          保存时浏览器会请求访问该厂商的域名，请点击「允许」。
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:underline"
        >
          稍后再说
        </button>
      </DialogContent>
    </Dialog>
  )
}
