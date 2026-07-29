import { create } from 'zustand'
import { toast as sonnerToast } from 'sonner'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

/** Background → UI 的 toast 广播消息（在 pending store 的运行时订阅里处理）。 */
export interface ToastMessage {
  type: 'mt:toast'
  payload: { kind: ToastKind; message: string; id?: string }
}

// ── Toast 规则（2026-07-28 定义，调研依据见 PROJECT_LOG.md）──
//
// 1. 同屏上限 3 条（sonner 默认 visibleToasts=3，不改）
// 2. 去重：调用方传稳定 id → sonner 对同 id 自动原地更新，不新增堆叠。
//    id 按「场景」命名（如 'add-url' / 'import-html'），同场景重复触发只保留一条。
//    未传 id 时回退为 message 本身作 id —— 同文案天然去重。
// 3. 批量操作必须在调用方聚合成一条汇总 toast，禁止循环内逐条 push。
// 4. 时长按类型区分：success/info 3s、warning 5s、error 8s。
//    error 额外带关闭按钮（时间长，允许用户主动关掉）。

const DURATIONS: Record<ToastKind, number> = {
  success: 3000,
  info: 3000,
  warning: 5000,
  error: 8000,
}

interface ToastState {
  /**
   * 发送 toast。id 是去重键：同 id 的 toast 会被原地更新而非新增。
   * 不传 id 时用 message 兜底（同文案自动去重）。
   */
  pushToast: (kind: ToastKind, message: string, id?: string) => void
}

export const useToastStore = create<ToastState>(() => ({
  pushToast: (kind, message, id) => {
    const opts = {
      id: id ?? message,
      duration: DURATIONS[kind],
      closeButton: kind === 'error',
    }
    switch (kind) {
      case 'success': sonnerToast.success(message, opts); break
      case 'error':   sonnerToast.error(message, opts);   break
      case 'warning': sonnerToast.warning(message, opts); break
      default:        sonnerToast(message, opts)
    }
  },
}))
