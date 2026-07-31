// Button 的 cva 变体定义，从 button.tsx 拆出：
// 组件文件只导出组件才能启用 Vite fast refresh（react-refresh/only-export-components）。
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 aria-invalid:ring-destructive/20 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        // 主按钮：bg=primary，hover 降透明度（深浅色都成立；避免深色下 hover 变纯黑导致黑底黑字）
        default:
          'bg-primary text-primary-foreground hover:opacity-90',
        // 规范 5.6.8 危险按钮：bg=error, hover=opacity 0.9
        destructive:
          'bg-destructive text-white hover:opacity-90 focus-visible:ring-destructive/30',
        // 规范 5.6.8 Ghost：transparent + border + hover=surface-hover
        outline:
          'border bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-[rgba(255,255,255,0.20)] dark:hover:border-[rgba(255,255,255,0.30)]',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
