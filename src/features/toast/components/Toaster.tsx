// shadcn/ui Sonner toaster — adapted from https://ui.shadcn.com (MIT)
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useThemeStore } from '@/features/theme'

const Toaster = ({ ...props }: ToasterProps) => {
  const effective = useThemeStore((s) => s.effective)

  return (
    <Sonner
      theme={effective as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--mt-glass-bg-solid)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--mt-glass-border)',
          '--success-bg': 'var(--mt-glass-bg-solid)',
          '--success-text': 'var(--mt-success)',
          '--success-border': 'var(--mt-glass-border)',
          '--error-bg': 'var(--mt-glass-bg-solid)',
          '--error-text': 'var(--mt-error)',
          '--error-border': 'var(--mt-glass-border)',
          '--warning-bg': 'var(--mt-glass-bg-solid)',
          '--warning-text': 'var(--mt-warning)',
          '--warning-border': 'var(--mt-glass-border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
