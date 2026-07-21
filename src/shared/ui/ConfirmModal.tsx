// useConfirm — 基于 shadcn AlertDialog。
// API 保持不变（ask({title, description, danger, ...}) → Promise<boolean>），调用方零改动。

import { createContext, useCallback, useContext, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { buttonVariants } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type AskFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<AskFn | null>(null)

export function useConfirm(): AskFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be inside <ConfirmProvider>')
  return ctx
}

interface State {
  opts: ConfirmOptions
  resolve: (v: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State | null>(null)

  const ask = useCallback<AskFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  )

  const close = useCallback((value: boolean) => {
    setState((cur) => {
      cur?.resolve(value)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <AlertDialog
        open={state !== null}
        onOpenChange={(open) => {
          if (!open) close(false)
        }}
      >
        {state && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{state.opts.title}</AlertDialogTitle>
              <AlertDialogDescription className={cn(!state.opts.description && 'sr-only')}>
                {state.opts.description || state.opts.title}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => close(false)}>
                {state.opts.cancelText ?? '取消'}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => close(true)}
                className={cn(
                  state.opts.danger &&
                    buttonVariants({ variant: 'destructive' }),
                )}
              >
                {state.opts.confirmText ?? '确认'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}
