import { useEffect, useState } from 'react'
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
import { Label } from '@/shared/ui/label'
import { MSG } from '@/shared/messages'
import { useBookmarkStore } from '@/features/bookmarks'
import { useToastStore } from '@/features/toast'

interface Props {
  open: boolean
  onClose: () => void
}

export function AddUrlModal({ open, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const pushToast = useToastStore((s) => s.pushToast)

  useEffect(() => {
    if (!open) {
      setUrl('')
      setTitle('')
      setBusy(false)
    }
  }, [open])

  const submit = async () => {
    const normalized = normalizeUrl(url.trim())
    if (!normalized) {
      pushToast('warning', '请输入有效的 URL', 'add-url-invalid')
      return
    }
    setBusy(true)
    try {
      const res = await chrome.runtime.sendMessage({
        type: MSG.saveUrl,
        payload: { url: normalized, title: title.trim() || undefined },
      })
      if (res?.ok === false) {
        pushToast('error', res.error ?? '添加失败', 'add-url-error')
        setBusy(false)
        return
      }
      if (res?.duplicated) {
        pushToast('info', '该页面已在收藏库中', 'add-url-dup')
      } else {
        pushToast('success', '已添加到收藏库', 'add-url-ok')
        void useBookmarkStore.getState().hydrate()
      }
      onClose()
    } catch (e) {
      pushToast('error', `添加失败：${(e as Error).message}`, 'add-url-error')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div>
          <DialogHeader>
            <DialogTitle>添加网址</DialogTitle>
            <DialogCloseButton />
          </DialogHeader>
          <DialogDescription className="mt-1.5">
            输入完整 URL，系统会自动建立索引并归入收藏。
          </DialogDescription>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-url-input">网址</Label>
            <Input
              id="add-url-input"
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-url-title">标题（可选）</Label>
            <Input
              id="add-url-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="自定义标题"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button onClick={submit} disabled={busy || !url.trim()}>
            {busy ? '添加中…' : '添加'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function normalizeUrl(s: string): string | null {
  if (!s) return null
  let v = s
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try {
    return new URL(v).toString()
  } catch {
    return null
  }
}
