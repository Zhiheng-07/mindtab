import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { cn } from '@/shared/lib/utils'
import { useBookmarkStore } from '@/features/bookmarks'
import { useToastStore } from '@/features/toast'

/** CJK 占 2，其余占 1 */
function charWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    // CJK Unified Ideographs + Extension A/B + Compatibility
    w += /[一-鿿㐀-䶿豈-﫿]/.test(ch) ? 2 : 1
  }
  return w
}

const WIDTH_MAX = 16

interface Props {
  open: boolean
  onClose: () => void
}

export function AddFolderModal({ open, onClose }: Props) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const addFolder = useBookmarkStore((s) => s.addFolder)
  const pushToast = useToastStore((s) => s.pushToast)

  const width = charWidth(name)
  const overLimit = width > WIDTH_MAX
  const showError = touched && overLimit

  // 关闭时重置表单（渲染期间调整状态）；timer 清理留在无 setState 的 effect 里
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (!open) {
      setName('')
      setBusy(false)
      setTouched(false)
      setShaking(false)
    }
  }

  useEffect(() => {
    if (!open && timerRef.current) clearTimeout(timerRef.current)
  }, [open])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setName(v)
    setTouched(false)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (charWidth(v) > WIDTH_MAX) {
        setTouched(true)
        setShaking(true)
        setTimeout(() => setShaking(false), 200)
      }
    }, 1500)
  }

  const clearName = () => {
    setName('')
    setTouched(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    inputRef.current?.focus()
  }

  const submit = async () => {
    const v = name.trim()
    if (!v || overLimit) return
    setBusy(true)
    try {
      await addFolder(v)
      pushToast('success', '已创建', 'folder-create')
      onClose()
    } catch (e) {
      pushToast('error', `创建失败：${(e as Error).message}`, 'folder-create-fail')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="-mt-1">
          <DialogTitle className="leading-9">新建文件夹</DialogTitle>
          <DialogDescription className="sr-only">输入新文件夹名称</DialogDescription>
          <DialogCloseButton />
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          <div className="relative">
            <Input
              ref={inputRef}
              id="folder-name"
              autoFocus
              value={name}
              onChange={handleChange}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="最多 8 个中文或 16 个英文"
              className={cn(
                showError && 'border-destructive focus:border-destructive',
                shaking && 'animate-shake',
                name && 'pr-8',
              )}
            />
            {name && (
              <button
                type="button"
                onClick={clearName}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {showError ? (
            <span className="text-xs text-destructive" style={{ marginLeft: 4 }}>超出字数限制</span>
          ) : (
            <span className="text-xs text-muted-foreground self-end" style={{ marginRight: 4 }}>
              {width}/{WIDTH_MAX}
            </span>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || overLimit}>
            {busy ? '创建中…' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
