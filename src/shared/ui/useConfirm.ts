// useConfirm hook 与 Context，从 ConfirmModal.tsx 拆出：
// 组件文件只导出组件才能启用 Vite fast refresh（react-refresh/only-export-components）。
// API 不变：ask({title, description, danger, ...}) → Promise<boolean>。

import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

export type AskFn = (opts: ConfirmOptions) => Promise<boolean>

export const ConfirmContext = createContext<AskFn | null>(null)

export function useConfirm(): AskFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be inside <ConfirmProvider>')
  return ctx
}
