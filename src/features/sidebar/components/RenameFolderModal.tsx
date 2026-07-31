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

/** CJK 占 2，其余占 1 */
function charWidth(s: string): number {
  let w = 0
  for (const ch of s) {
    w += /[一-鿿㐀-䶿豈-﫿]/.test(ch) ? 2 : 1
  }
  return w
}

const WIDTH_MAX = 16

interface Props {
  open: boolean
  initial: string
  onClose: () => void
  onSubmit: (name: string) => void
}

export function RenameFolderModal({ open, initial, onClose, onSubmit }: Props) {
  const [name, setName] = useState(initial)
  const [touched, setTouched] = useState(false)
  const [shaking, setShaking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const width = charWidth(name)
  const overLimit = width > WIDTH_MAX
  const showError = touched && overLimit

  // 打开或 initial 变化时重置（渲染期间调整状态，保留原 [open, initial] deps 语义）；
  // timer 清理留在无 setState 的 effect 里
  const [prev, setPrev] = useState({ open, initial })
  if (open !== prev.open || initial !== prev.initial) {
    setPrev({ open, initial })
    if (open) {
      setName(initial)
      setTouched(false)
      setShaking(false)
    }
  }

  useEffect(() => {
    if (open && timerRef.current) clearTimeout(timerRef.current)
  }, [open, initial])

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

  const submit = () => {
    const v = name.trim()
    if (!v || overLimit) return
    onSubmit(v)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重命名文件夹</DialogTitle>
          <DialogDescription className="sr-only">修改文件夹名称</DialogDescription>
          <DialogCloseButton />
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-1">
          <div className="relative">
            <Input
              ref={inputRef}
              id="rename-name"
              autoFocus
              value={name}
              onChange={handleChange}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
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
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit} disabled={!name.trim() || overLimit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
