// 旧 ContextMenu 现在用 shadcn DropdownMenu 实现，API 不变。
// 父组件控制 anchor 坐标（x/y），渲染一个不可见 trigger 在 anchor 处然后 dropdown 打开。

import { useEffect, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

export interface ContextMenuItem {
  key: string
  label: string
  danger?: boolean
  onSelect: () => void
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)

  // 挂上后立即模拟一次"点击"trigger 打开菜单
  useEffect(() => {
    triggerRef.current?.click()
  }, [])

  return (
    <DropdownMenu defaultOpen onOpenChange={(o) => !o && onClose()}>
      <DropdownMenuTrigger asChild>
        <button
          ref={triggerRef}
          aria-hidden
          tabIndex={-1}
          style={{
            position: 'fixed',
            top: y,
            left: x,
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.key}
            variant={it.danger ? 'destructive' : 'default'}
            onSelect={(e) => {
              e.preventDefault()
              it.onSelect()
              onClose()
            }}
            className={cn(it.danger && 'text-destructive')}
          >
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
