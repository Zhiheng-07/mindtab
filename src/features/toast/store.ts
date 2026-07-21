import { create } from 'zustand'
import { toast as sonnerToast } from 'sonner'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

/** Background → UI 的 toast 广播消息（在 pending store 的运行时订阅里处理）。 */
export interface ToastMessage {
  type: 'mt:toast'
  payload: { kind: ToastKind; message: string }
}

interface ToastState {
  // 薄包装 sonner，签名保持不变
  pushToast: (kind: ToastKind, message: string) => void
}

export const useToastStore = create<ToastState>(() => ({
  pushToast: (kind, message) => {
    switch (kind) {
      case 'success': sonnerToast.success(message); break
      case 'error':   sonnerToast.error(message);   break
      case 'warning': sonnerToast.warning(message); break
      default:        sonnerToast(message)
    }
  },
}))
